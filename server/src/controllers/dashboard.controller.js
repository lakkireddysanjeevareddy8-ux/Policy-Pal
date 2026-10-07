import { query } from '../db/index.js';

export async function getDashboard(req, res, next) {
  try {
    const userId = req.user.id;

    // 1. Total matches count
    const totalMatchesRes = await query(
      'SELECT COUNT(*)::int as count FROM scheme_matches WHERE user_id = $1',
      [userId]
    );
    const totalMatches = totalMatchesRes.rows[0].count;

    // 2. Applications in progress
    const inProgressRes = await query(
      "SELECT COUNT(*)::int as count FROM scheme_matches WHERE user_id = $1 AND status = 'applying'",
      [userId]
    );
    const applicationsInProgress = inProgressRes.rows[0].count;

    // 3. Document readiness stats
    const userDocsRes = await query(
      'SELECT doc_key, is_ready FROM user_documents WHERE user_id = $1',
      [userId]
    );
    const readyDocsSet = new Set(
      userDocsRes.rows.filter((d) => d.is_ready).map((d) => d.doc_key)
    );

    // 4. Fetch all user's scheme matches with scheme details to calculate overall readiness and top closest
    const matchesRes = await query(
      `SELECT
         sm.id, sm.scheme_id, sm.match_score, sm.status,
         s.slug, s.name, s.name_te, s.name_hi, s.category, s.benefit_summary,
         s.required_doc_keys
       FROM scheme_matches sm
       JOIN schemes s ON s.id = sm.scheme_id
       WHERE sm.user_id = $1`,
      [userId]
    );

    // Collect all unique required documents across all user's matched schemes
    const uniqueRequiredDocs = new Set();
    const schemeReadinessList = matchesRes.rows.map((m) => {
      const required = m.required_doc_keys || [];
      required.forEach((doc) => uniqueRequiredDocs.add(doc));

      const readyCount = required.filter((doc) => readyDocsSet.has(doc)).length;
      const totalCount = required.length;
      const readinessPercent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 100;

      return {
        id: m.id,
        scheme_id: m.scheme_id,
        slug: m.slug,
        name: m.name,
        name_te: m.name_te,
        name_hi: m.name_hi,
        category: m.category,
        benefit_summary: m.benefit_summary,
        match_score: m.match_score,
        status: m.status,
        ready_docs_count: readyCount,
        total_docs_count: totalCount,
        readiness_percent: readinessPercent,
        missing_docs_count: totalCount - readyCount,
      };
    });

    // Overall document readiness percent
    let overallReadinessPercent = 0;
    if (uniqueRequiredDocs.size > 0) {
      let uniqueReadyCount = 0;
      uniqueRequiredDocs.forEach((doc) => {
        if (readyDocsSet.has(doc)) uniqueReadyCount++;
      });
      overallReadinessPercent = Math.round((uniqueReadyCount / uniqueRequiredDocs.size) * 100);
    } else if (userDocsRes.rows.length > 0) {
      // Fallback: ratio of ready docs to total 16 standard types
      overallReadinessPercent = Math.round((readyDocsSet.size / 16) * 100);
    }

    // Category Distribution for charts
    const categoryCounts = {};
    const statusCounts = { saved: 0, applying: 0, applied: 0, rejected: 0 };

    matchesRes.rows.forEach((m) => {
      const cat = m.category || 'other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (statusCounts[m.status] !== undefined) {
        statusCounts[m.status]++;
      } else {
        statusCounts[m.status] = 1;
      }
    });

    const categoryDistribution = Object.entries(categoryCounts).map(([cat, count]) => ({
      category: cat,
      count,
    }));

    const statusFunnel = [
      { status: 'saved', label: 'Saved Schemes', count: statusCounts.saved || 0, fill: '#3b82f6' },
      { status: 'applying', label: 'In Progress (Applying)', count: statusCounts.applying || 0, fill: '#f59e0b' },
      { status: 'applied', label: 'Applied (Submitted)', count: statusCounts.applied || 0, fill: '#10b981' },
    ];

    // Top 3 closest to ready schemes
    // Priority: highest readiness_percent, then highest match_score
    schemeReadinessList.sort((a, b) => {
      if (b.readiness_percent !== a.readiness_percent) {
        return b.readiness_percent - a.readiness_percent;
      }
      return b.match_score - a.match_score;
    });

    const topClosestSchemes = schemeReadinessList.slice(0, 3);

    return res.json({
      success: true,
      data: {
        stats: {
          total_matches: totalMatches,
          applications_in_progress: applicationsInProgress,
          total_ready_documents: readyDocsSet.size,
          total_tracked_documents: uniqueRequiredDocs.size || 16,
          overall_document_readiness_percent: overallReadinessPercent,
        },
        charts: {
          category_distribution: categoryDistribution,
          status_funnel: statusFunnel,
          readiness_ring: {
            ready_percent: overallReadinessPercent,
            ready_count: readyDocsSet.size,
            total_count: uniqueRequiredDocs.size || 16,
          },
        },
        top_closest_to_ready_schemes: topClosestSchemes,
      },
    });
  } catch (err) {
    next(err);
  }
}
