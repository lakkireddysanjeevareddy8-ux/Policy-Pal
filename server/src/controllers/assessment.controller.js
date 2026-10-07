import { query } from '../db/index.js';
import {
  extractProfile,
  matchSchemes,
  buildChecklistsForMatches,
} from '../services/ai/gemini.service.js';

export async function createAssessment(req, res, next) {
  try {
    const userId = req.user.id;
    const { situation_text, language = 'en' } = req.body;
    const trimmedText = situation_text.trim();

    // 0. Cache check: If same user submitted identical situation_text & language within 24 hours, return saved assessment
    const cachedRes = await query(
      `SELECT id, user_id, situation_text, language, extracted_profile, ai_summary, archived, created_at, updated_at
       FROM assessments
       WHERE user_id = $1
         AND situation_text = $2
         AND language = $3
         AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, trimmedText, language]
    );

    if (cachedRes.rows.length > 0) {
      console.log(`⚡ [AI Cache Hit] Reusing existing assessment ${cachedRes.rows[0].id} from last 24h`);
      const cachedAssessment = cachedRes.rows[0];

      const matchesRes = await query(
        'SELECT * FROM scheme_matches WHERE assessment_id = $1 AND user_id = $2 ORDER BY match_score DESC',
        [cachedAssessment.id, userId]
      );

      const catalogRes = await query('SELECT * FROM schemes');
      const catalogMap = new Map(catalogRes.rows.map((s) => [s.id, s]));
      const enrichedMatches = await enrichMatchesWithReadiness(userId, matchesRes.rows, catalogMap);

      return res.status(200).json({
        success: true,
        cached: true,
        data: {
          assessment: {
            ...cachedAssessment,
            missing_info: matchesRes.rows[0]?.missing_info || [],
          },
          matches: enrichedMatches,
        },
      });
    }

    console.log(`🤖 Starting AI assessment workflow for user ${userId} in [${language}]...`);

    // 1. Extract Profile & AI Summary
    const extractionResult = await extractProfile(situation_text, language);
    const { profile: extractedProfile, summary: aiSummary, missing_info = [] } = extractionResult;

    // 2. Fetch Scheme Catalog for matching
    const catalogRes = await query(
      `SELECT id, slug, name, name_te, name_hi, ministry, level, state,
              category, benefit_summary, eligibility_summary, required_doc_keys,
              application_steps, official_url, last_verified
       FROM schemes`
    );
    const catalog = catalogRes.rows;
    const catalogMap = new Map(catalog.map((s) => [s.id, s]));

    // 3. Match Schemes with AI
    const rawMatches = await matchSchemes(extractedProfile, catalog, language);

    // 4. Build Checklists with AI in parallel (capped concurrency)
    const matchesWithChecklists = await buildChecklistsForMatches(
      extractedProfile,
      rawMatches,
      catalogMap,
      language
    );

    // 5. Save Assessment into Database
    const assessmentRes = await query(
      `INSERT INTO assessments (user_id, situation_text, language, extracted_profile, ai_summary, ai_source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, situation_text, language, extracted_profile, ai_summary, ai_source, archived, created_at, updated_at`,
      [
        userId,
        situation_text,
        language,
        JSON.stringify(extractedProfile),
        aiSummary,
        'gemini',
      ]
    );

    const assessment = assessmentRes.rows[0];

    // 6. Save Matches into Database
    const savedMatches = [];
    for (const match of matchesWithChecklists) {
      const matchRes = await query(
        `INSERT INTO scheme_matches (
           assessment_id, user_id, scheme_id, match_score,
           eligibility_reason, missing_info, status, ai_checklist, assumptions_to_confirm
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          assessment.id,
          userId,
          match.scheme_id,
          match.match_score,
          match.eligibility_reason,
          JSON.stringify(missing_info),
          'saved',
          JSON.stringify(match.checklist || []),
          JSON.stringify(match.assumptions_to_confirm || []),
        ]
      );
      savedMatches.push(matchRes.rows[0]);
    }

    // 7. Auto-populate user profile fields if not already populated
    await query(
      `UPDATE profiles
       SET
         age = COALESCE(age, $1),
         gender = COALESCE(gender, $2),
         state = COALESCE(state, $3),
         occupation = COALESCE(occupation, $4),
         annual_income = COALESCE(annual_income, $5),
         social_category = COALESCE(social_category, $6),
         land_holding_acres = COALESCE(land_holding_acres, $7),
         is_student = COALESCE(is_student, $8),
         is_farmer = COALESCE(is_farmer, $9),
         is_business_owner = COALESCE(is_business_owner, $10),
         updated_at = NOW()
       WHERE user_id = $11`,
      [
        extractedProfile.age,
        extractedProfile.gender,
        extractedProfile.state,
        extractedProfile.occupation,
        extractedProfile.annual_income,
        extractedProfile.social_category,
        extractedProfile.land_holding_acres,
        extractedProfile.is_student,
        extractedProfile.is_farmer,
        extractedProfile.is_business_owner,
        userId,
      ]
    );

    // 8. Enrich matches with document readiness
    const enrichedMatches = await enrichMatchesWithReadiness(userId, savedMatches, catalogMap);

    return res.status(201).json({
      success: true,
      cached: false,
      data: {
        assessment: {
          ...assessment,
          missing_info,
        },
        matches: enrichedMatches,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAssessments(req, res, next) {
  try {
    const userId = req.user.id;
    const { archived, q, sort_by = 'date', order = 'desc' } = req.query;

    const conditions = ['a.user_id = $1'];
    const params = [userId];
    let paramIndex = 2;

    if (archived !== undefined) {
      conditions.push(`a.archived = $${paramIndex}`);
      params.push(archived === 'true');
      paramIndex++;
    }

    if (q && q.trim()) {
      conditions.push(`(a.situation_text ILIKE $${paramIndex} OR a.ai_summary ILIKE $${paramIndex})`);
      params.push(`%${q.trim()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    let orderByClause = 'ORDER BY a.created_at DESC';
    const direction = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (sort_by === 'score') {
      orderByClause = `ORDER BY COALESCE(MAX(sm.match_score), 0) ${direction}, a.created_at DESC`;
    } else if (sort_by === 'date') {
      orderByClause = `ORDER BY a.created_at ${direction}`;
    }

    const assessmentsRes = await query(
      `SELECT
         a.id, a.user_id, a.situation_text, a.language,
         a.extracted_profile, a.ai_summary, a.archived,
         a.created_at, a.updated_at,
         COUNT(sm.id)::int as matches_count,
         COALESCE(MAX(sm.match_score), 0)::int as top_score
       FROM assessments a
       LEFT JOIN scheme_matches sm ON sm.assessment_id = a.id
       ${whereClause}
       GROUP BY a.id
       ${orderByClause}`,
      params
    );

    return res.json({
      success: true,
      data: {
        assessments: assessmentsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAssessmentById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const assessmentRes = await query(
      `SELECT id, user_id, situation_text, language, extracted_profile, ai_summary, archived, created_at, updated_at
       FROM assessments
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (assessmentRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found or unauthorized',
        },
      });
    }

    const assessment = assessmentRes.rows[0];

    // Fetch matches for this assessment
    const matchesRes = await query(
      `SELECT * FROM scheme_matches WHERE assessment_id = $1 AND user_id = $2 ORDER BY match_score DESC`,
      [id, userId]
    );

    const catalogRes = await query('SELECT * FROM schemes');
    const catalogMap = new Map(catalogRes.rows.map((s) => [s.id, s]));

    const enrichedMatches = await enrichMatchesWithReadiness(userId, matchesRes.rows, catalogMap);

    return res.json({
      success: true,
      data: {
        assessment,
        matches: enrichedMatches,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { situation_text, archived } = req.body;

    const fields = [];
    const params = [id, userId];
    let paramIndex = 3;

    if (situation_text !== undefined) {
      fields.push(`situation_text = $${paramIndex}`);
      params.push(situation_text);
      paramIndex++;
    }

    if (archived !== undefined) {
      fields.push(`archived = $${paramIndex}`);
      params.push(archived);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATE_FIELDS',
          message: 'No fields provided for update',
        },
      });
    }

    fields.push('updated_at = NOW()');

    const updateRes = await query(
      `UPDATE assessments
       SET ${fields.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      params
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found or unauthorized',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        assessment: updateRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleteRes = await query(
      'DELETE FROM assessments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found or unauthorized',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'Assessment and associated matches deleted successfully',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function rerunAssessment(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const assessmentRes = await query(
      'SELECT id, situation_text, language FROM assessments WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (assessmentRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found or unauthorized',
        },
      });
    }

    const { situation_text, language } = assessmentRes.rows[0];

    // Re-run AI workflow
    const extractionResult = await extractProfile(situation_text, language);
    const { profile: extractedProfile, summary: aiSummary, missing_info = [] } = extractionResult;

    const catalogRes = await query('SELECT * FROM schemes');
    const catalog = catalogRes.rows;
    const catalogMap = new Map(catalog.map((s) => [s.id, s]));

    const rawMatches = await matchSchemes(extractedProfile, catalog, language);
    const matchesWithChecklists = await buildChecklistsForMatches(
      extractedProfile,
      rawMatches,
      catalogMap,
      language
    );

    // Remove existing matches for this assessment
    await query('DELETE FROM scheme_matches WHERE assessment_id = $1', [id]);

    // Update assessment
    const updatedAssessmentRes = await query(
      `UPDATE assessments
       SET extracted_profile = $1, ai_summary = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(extractedProfile), aiSummary, id]
    );

    // Insert fresh matches
    const savedMatches = [];
    for (const match of matchesWithChecklists) {
      const matchRes = await query(
        `INSERT INTO scheme_matches (
           assessment_id, user_id, scheme_id, match_score,
           eligibility_reason, missing_info, status, ai_checklist
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          id,
          userId,
          match.scheme_id,
          match.match_score,
          match.eligibility_reason,
          JSON.stringify(missing_info),
          'saved',
          JSON.stringify(match.checklist || []),
        ]
      );
      savedMatches.push(matchRes.rows[0]);
    }

    const enrichedMatches = await enrichMatchesWithReadiness(userId, savedMatches, catalogMap);

    return res.json({
      success: true,
      data: {
        assessment: {
          ...updatedAssessmentRes.rows[0],
          missing_info,
        },
        matches: enrichedMatches,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Helper to calculate document readiness for matches
async function enrichMatchesWithReadiness(userId, matches, catalogMap) {
  const userDocsRes = await query(
    'SELECT doc_key, is_ready, notes FROM user_documents WHERE user_id = $1',
    [userId]
  );
  const userDocMap = new Map(userDocsRes.rows.map((ud) => [ud.doc_key, ud]));

  const allDocTypesRes = await query('SELECT key, label, label_te, label_hi, where_to_get FROM document_types');
  const docMetaMap = new Map(allDocTypesRes.rows.map((d) => [d.key, d]));

  return matches.map((m) => {
    const scheme = catalogMap.get(m.scheme_id) || {};
    const requiredKeys = scheme.required_doc_keys || [];
    const totalDocs = requiredKeys.length;

    let readyCount = 0;
    const requiredDocsList = requiredKeys.map((key) => {
      const meta = docMetaMap.get(key) || { key, label: key, where_to_get: '' };
      const ud = userDocMap.get(key);
      const isReady = ud ? ud.is_ready : false;
      if (isReady) readyCount++;
      return {
        key,
        label: meta.label,
        label_te: meta.label_te,
        label_hi: meta.label_hi,
        where_to_get: meta.where_to_get,
        is_ready: isReady,
        notes: ud ? ud.notes : null,
      };
    });

    const readinessPercent = totalDocs > 0 ? Math.round((readyCount / totalDocs) * 100) : 100;

    return {
      ...m,
      scheme_slug: scheme.slug,
      scheme_name: scheme.name,
      scheme_name_te: scheme.name_te,
      scheme_name_hi: scheme.name_hi,
      category: scheme.category,
      level: scheme.level,
      benefit_summary: scheme.benefit_summary,
      eligibility_summary: scheme.eligibility_summary,
      official_url: scheme.official_url,
      total_docs_count: totalDocs,
      ready_docs_count: readyCount,
      readiness_percent: readinessPercent,
      required_documents: requiredDocsList,
    };
  });
}
