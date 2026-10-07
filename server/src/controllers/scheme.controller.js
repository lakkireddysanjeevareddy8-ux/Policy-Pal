import { query } from '../db/index.js';

function getRequestedLang(req) {
  if (req.query.lang) return req.query.lang;
  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    const first = acceptLang.split(',')[0]?.split(';')[0]?.split('-')[0]?.trim();
    if (first) return first;
  }
  return 'en';
}

function localizeScheme(scheme, lang) {
  if (!scheme) return scheme;
  const translations = scheme.translations || {};
  const t = translations[lang] || {};

  return {
    ...scheme,
    name: t.name || (lang === 'te' && scheme.name_te) || (lang === 'hi' && scheme.name_hi) || scheme.name,
    benefit_summary: t.benefit_summary || scheme.benefit_summary,
    eligibility_summary: t.eligibility_summary || scheme.eligibility_summary,
  };
}

export async function getSchemes(req, res, next) {
  try {
    const {
      q,
      category,
      level,
      page = 1,
      limit = 20,
    } = req.query;

    const lang = getRequestedLang(req);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      conditions.push(
        `(s.name ILIKE $${paramIndex} OR s.name_te ILIKE $${paramIndex} OR s.name_hi ILIKE $${paramIndex} OR s.ministry ILIKE $${paramIndex} OR s.benefit_summary ILIKE $${paramIndex} OR s.eligibility_summary ILIKE $${paramIndex})`
      );
      params.push(searchTerm);
      paramIndex++;
    }

    if (category && category !== 'all') {
      conditions.push(`s.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (level && level !== 'all') {
      conditions.push(`s.level = $${paramIndex}`);
      params.push(level);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countRes = await query(
      `SELECT COUNT(*) as total FROM schemes s ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    // Data query
    const dataRes = await query(
      `SELECT
         s.id, s.slug, s.name, s.name_te, s.name_hi,
         s.ministry, s.level, s.state, s.category,
         s.benefit_summary, s.eligibility_summary,
         s.required_doc_keys, s.official_url, s.last_verified,
         s.translations
       FROM schemes s
       ${whereClause}
       ORDER BY s.name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    const localizedSchemes = dataRes.rows.map((s) => localizeScheme(s, lang));

    return res.json({
      success: true,
      data: {
        schemes: localizedSchemes,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          total_pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSchemeBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const lang = getRequestedLang(req);

    const schemeRes = await query(
      `SELECT
         s.id, s.slug, s.name, s.name_te, s.name_hi,
         s.ministry, s.level, s.state, s.category,
         s.benefit_summary, s.eligibility_summary,
         s.required_doc_keys, s.application_steps,
         s.official_url, s.last_verified, s.translations,
         s.created_at, s.updated_at
       FROM schemes s
       WHERE s.slug = $1`,
      [slug]
    );

    if (schemeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHEME_NOT_FOUND',
          message: `Scheme with slug '${slug}' not found`,
        },
      });
    }

    const scheme = schemeRes.rows[0];

    // Fetch details of required documents
    let requiredDocs = [];
    if (scheme.required_doc_keys && scheme.required_doc_keys.length > 0) {
      const docsRes = await query(
        `SELECT key, label, label_te, label_hi, where_to_get, translations
         FROM document_types
         WHERE key = ANY($1::text[])`,
        [scheme.required_doc_keys]
      );
      requiredDocs = docsRes.rows.map((doc) => {
        const t = (doc.translations || {})[lang] || {};
        return {
          ...doc,
          label: t.label || (lang === 'te' && doc.label_te) || (lang === 'hi' && doc.label_hi) || doc.label,
          where_to_get: t.where_to_get || doc.where_to_get,
        };
      });
    }

    const localizedScheme = localizeScheme(scheme, lang);

    return res.json({
      success: true,
      data: {
        scheme: {
          ...localizedScheme,
          required_documents: requiredDocs,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
