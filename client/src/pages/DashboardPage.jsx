import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReadinessBadge from '../components/ReadinessBadge.jsx';
import {
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Calendar,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, t, language } = useAuth();
  const [stats, setStats] = useState(null);
  const [topSchemes, setTopSchemes] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        const [dashRes, assessRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/assessments'),
        ]);

        if (dashRes.data?.success) {
          setStats(dashRes.data.data.stats);
          setTopSchemes(dashRes.data.data.top_closest_to_ready_schemes || []);
        }

        if (assessRes.data?.success) {
          setAssessments(assessRes.data.data.assessments || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard. Please refresh or try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const getSchemeName = (scheme) => {
    if (language === 'te' && scheme.name_te) return scheme.name_te;
    if (language === 'hi' && scheme.name_hi) return scheme.name_hi;
    return scheme.name;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Citizen Welfare Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t('welcomeBack')}, {user?.full_name || 'Citizen'}!
          </h1>
          <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
            Your centralized overview of eligible government schemes, real-time application progress,
            and shared document readiness.
          </p>
          <div className="pt-2">
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-emerald-950 bg-amber-400 hover:bg-amber-300 shadow-md transition transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-emerald-900" />
              <span>{t('startNewAssessment')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Decorative blur rings */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-60 h-60 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Key Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Matches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('totalMatches')}
            </p>
            <p className="text-3xl font-extrabold text-slate-900">{stats?.total_matches || 0}</p>
            <Link to="/applications" className="text-xs font-semibold text-emerald-600 hover:underline">
              View all matches →
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Applications in progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('applicationsInProgress')}
            </p>
            <p className="text-3xl font-extrabold text-amber-600">
              {stats?.applications_in_progress || 0}
            </p>
            <span className="text-xs text-slate-400">Currently applying</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Overall Document Readiness */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('overallReadiness')}
            </p>
            <p className="text-3xl font-extrabold text-teal-600">
              {stats?.overall_document_readiness_percent || 0}%
            </p>
            <Link to="/documents" className="text-xs font-semibold text-teal-600 hover:underline">
              Manage documents →
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Ready Documents */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('totalReadyDocs')}
            </p>
            <p className="text-3xl font-extrabold text-slate-900">
              {stats?.total_ready_documents || 0}
              <span className="text-sm font-normal text-slate-400"> / {stats?.total_tracked_documents || 16}</span>
            </p>
            <span className="text-xs text-slate-400">Shared across schemes</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Top 3 Schemes Closest to Application-Ready */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{t('closestToReady')}</span>
            </h2>
            <p className="text-xs text-slate-500">
              Schemes with the highest percentage of ready required documents
            </p>
          </div>
          <Link
            to="/documents"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
          >
            <span>Open Document Tracker</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {topSchemes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Matched Schemes Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Run an eligibility check with your situation to discover matching schemes.
            </p>
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700"
            >
              Start First Check
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {topSchemes.map((scheme, idx) => (
              <div
                key={scheme.id || idx}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {scheme.category}
                    </span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {scheme.match_score}% Match
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base line-clamp-2">
                    {getSchemeName(scheme)}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {scheme.benefit_summary}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <ReadinessBadge
                    readyCount={scheme.ready_docs_count}
                    totalCount={scheme.total_docs_count}
                    percentage={scheme.readiness_percent}
                  />

                  <Link
                    to={`/schemes/${scheme.slug}`}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <span>{t('viewScheme')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Assessments History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <span>Assessment History</span>
            </h2>
            <p className="text-xs text-slate-500">
              Previous eligibility evaluations generated with Gemini AI
            </p>
          </div>
        </div>

        {assessments.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-xs">
            No previous assessments found.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
            {assessments.slice(0, 5).map((a) => (
              <div
                key={a.id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {a.language?.toUpperCase() || 'EN'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(a.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    {a.archived && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">
                    "{a.situation_text}"
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">{a.ai_summary}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {a.matches_count || 0} Schemes Found
                  </span>
                  <Link
                    to={`/assessments/${a.id}`}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="View Assessment"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
