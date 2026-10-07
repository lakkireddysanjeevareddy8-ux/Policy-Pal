import { query } from '../db/index.js';

export async function getMatches(req, res, next) {
  try {
    const userId = req.user.id;
    const { status, category, min_score, sort_by = 'score', order = 'desc' } = req.query;

    const conditions = ['sm.user_id = $1'];
    const params = [userId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      conditions.push(`sm.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (category && category !== 'all') {
      conditions.push(`s.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (min_score) {
      conditions.push(`sm.match_score >= $${paramIndex}`);
      params.push(parseInt(min_score, 10));
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query matches with joined scheme details and document readiness computation
    const sql = `
      SELECT
        sm.id,
        sm.assessment_id,
        sm.user_id,
        sm.scheme_id,
        sm.match_score,
        sm.eligibility_reason,
        sm.missing_info,
        sm.status,
        sm.ai_checklist,
        sm.created_at,
        sm.updated_at,
        s.slug as scheme_slug,
        s.name as scheme_name,
        s.name_te as scheme_name_te,
        s.name_hi as scheme_name_hi,
        s.ministry,
        s.level,
        s.state,
        s.category,
        s.benefit_summary,
        s.eligibility_summary,
        s.required_doc_keys,
        s.official_url,
        s.last_verified,
        COALESCE(cardinality(s.required_doc_keys), 0) as total_docs_count,
        COALESCE(
          (
            SELECT COUNT(*)::int
            FROM user_documents ud
            WHERE ud.user_id = sm.user_id
              AND ud.is_ready = true
              AND ud.doc_key = ANY(s.required_doc_keys)
          ),
          0
        ) as ready_docs_count
      FROM scheme_matches sm
      JOIN schemes s ON s.id = sm.scheme_id
      ${whereClause}
    `;

    const result = await query(sql, params);

    // Fetch all document catalog entries to enrich required_documents
    const allDocsRes = await query('SELECT key, label, label_te, label_hi, where_to_get FROM document_types');
    const docMap = new Map(allDocsRes.rows.map((d) => [d.key, d]));

    // Fetch user's ready documents
    const userDocsRes = await query(
      'SELECT doc_key, is_ready, notes FROM user_documents WHERE user_id = $1',
      [userId]
    );
    const userDocStatus = new Map(userDocsRes.rows.map((ud) => [ud.doc_key, ud]));

    // Enrich rows with readiness_percent and required_documents array
    const enrichedMatches = result.rows.map((row) => {
      const totalDocs = row.total_docs_count;
      const readyDocs = row.ready_docs_count;
      const readinessPercent = totalDocs > 0 ? Math.round((readyDocs / totalDocs) * 100) : 100;

      const requiredDocsList = (row.required_doc_keys || []).map((key) => {
        const meta = docMap.get(key) || { key, label: key, where_to_get: '' };
        const userDoc = userDocStatus.get(key);
        return {
          key,
          label: meta.label,
          label_te: meta.label_te,
          label_hi: meta.label_hi,
          where_to_get: meta.where_to_get,
          is_ready: userDoc ? userDoc.is_ready : false,
          notes: userDoc ? userDoc.notes : null,
        };
      });

      return {
        ...row,
        total_docs_count: totalDocs,
        ready_docs_count: readyDocs,
        readiness_percent: readinessPercent,
        required_documents: requiredDocsList,
      };
    });

    // Client/query sorting
    enrichedMatches.sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1;
      if (sort_by === 'readiness') {
        if (a.readiness_percent !== b.readiness_percent) {
          return (a.readiness_percent - b.readiness_percent) * dir;
        }
        return (a.match_score - b.match_score) * dir;
      }
      // default: score
      if (a.match_score !== b.match_score) {
        return (a.match_score - b.match_score) * dir;
      }
      return (a.readiness_percent - b.readiness_percent) * dir;
    });

    return res.json({
      success: true,
      data: {
        matches: enrichedMatches,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMatchStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const updateRes = await query(
      `UPDATE scheme_matches
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, id, userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Scheme match record not found or access unauthorized',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        match: updateRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleChecklistStep(req, res, next) {
  try {
    const userId = req.user.id;
    const { id, index } = req.params;
    const stepIdx = parseInt(index, 10);
    const { done } = req.body;

    // Fetch existing match
    const matchRes = await query(
      'SELECT id, ai_checklist FROM scheme_matches WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (matchRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Scheme match record not found or access unauthorized',
        },
      });
    }

    const checklist = matchRes.rows[0].ai_checklist || [];
    if (stepIdx < 0 || stepIdx >= checklist.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STEP_INDEX',
          message: `Checklist index ${stepIdx} out of bounds (0-${checklist.length - 1})`,
        },
      });
    }

    // Toggle or set state
    const newDoneState = typeof done === 'boolean' ? done : !checklist[stepIdx].done;
    checklist[stepIdx].done = newDoneState;

    const updateRes = await query(
      `UPDATE scheme_matches
       SET ai_checklist = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, ai_checklist`,
      [JSON.stringify(checklist), id, userId]
    );

    return res.json({
      success: true,
      data: {
        id: updateRes.rows[0].id,
        ai_checklist: updateRes.rows[0].ai_checklist,
      },
    });
  } catch (err) {
    next(err);
  }
}
