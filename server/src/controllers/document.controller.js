import { query } from '../db/index.js';

export async function getDocuments(req, res, next) {
  try {
    const userId = req.user.id;

    // Fetch all document types merged with user's readiness state
    const docsRes = await query(
      `SELECT
         dt.key,
         dt.label,
         dt.label_te,
         dt.label_hi,
         dt.where_to_get,
         COALESCE(ud.is_ready, false) as is_ready,
         ud.notes,
         ud.ready_at,
         ud.updated_at
       FROM document_types dt
       LEFT JOIN user_documents ud ON ud.doc_key = dt.key AND ud.user_id = $1
       ORDER BY dt.label ASC`,
      [userId]
    );

    // Fetch user's active scheme matches to compute how many schemes need each document
    const userSchemesRes = await query(
      `SELECT s.id, s.name, s.slug, s.required_doc_keys
       FROM scheme_matches sm
       JOIN schemes s ON s.id = sm.scheme_id
       WHERE sm.user_id = $1`,
      [userId]
    );

    // If user has no matches yet, count against all catalog schemes
    const fallbackSchemesRes =
      userSchemesRes.rows.length === 0
        ? await query('SELECT id, name, slug, required_doc_keys FROM schemes')
        : null;

    const schemesList = userSchemesRes.rows.length > 0 ? userSchemesRes.rows : fallbackSchemesRes.rows;

    const enrichedDocs = docsRes.rows.map((doc) => {
      const schemesNeedingDoc = schemesList.filter(
        (s) => Array.isArray(s.required_doc_keys) && s.required_doc_keys.includes(doc.key)
      );

      return {
        ...doc,
        schemes_count: schemesNeedingDoc.length,
        schemes_using: schemesNeedingDoc.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
      };
    });

    return res.json({
      success: true,
      data: {
        documents: enrichedDocs,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDocument(req, res, next) {
  try {
    const userId = req.user.id;
    const { key } = req.params;
    const { is_ready, notes } = req.body;

    // Verify key exists in document_types
    const docTypeRes = await query('SELECT key FROM document_types WHERE key = $1', [key]);
    if (docTypeRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DOCUMENT_TYPE_NOT_FOUND',
          message: `Document type '${key}' does not exist`,
        },
      });
    }

    const readyAt = is_ready ? new Date() : null;

    const upsertRes = await query(
      `INSERT INTO user_documents (user_id, doc_key, is_ready, notes, ready_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, doc_key) DO UPDATE SET
         is_ready = EXCLUDED.is_ready,
         notes = COALESCE(EXCLUDED.notes, user_documents.notes),
         ready_at = CASE WHEN EXCLUDED.is_ready THEN NOW() ELSE NULL END,
         updated_at = NOW()
       RETURNING *`,
      [userId, key, is_ready, notes ?? null, readyAt]
    );

    return res.json({
      success: true,
      data: {
        document: upsertRes.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}
