import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ReadinessBadge from '../components/ReadinessBadge.jsx';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Calendar,
  RotateCw,
  Archive,
  ArchiveRestore,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [topSchemes, setTopSchemes] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('dashboard.title')}`;
  }, [t]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, assessRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/assessments'),
      ]);

      if (dashRes.data?.success) {
        setStats(dashRes.data.data.stats);
        setCharts(dashRes.data.data.charts);
        setTopSchemes(dashRes.data.data.top_closest_to_ready_schemes || []);
      }

      if (assessRes.data?.success) {
        setAssessments(assessRes.data.data.assessments || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRerun = async (assessmentId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading((prev) => ({ ...prev, [assessmentId]: 'rerun' }));

    try {
      const res = await api.post(`/assessments/${assessmentId}/rerun`);
      if (res.data?.success) {
        showToast(t('assessment.aiNotice'), 'success');
        await fetchDashboardData();
      }
    } catch (err) {
      showToast(t('errors.aiUnavailable'), 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [assessmentId]: null }));
    }
  };

  const handleToggleArchive = async (assessmentId, currentArchived, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading((prev) => ({ ...prev, [assessmentId]: 'archive' }));

    try {
      const res = await api.patch(`/assessments/${assessmentId}`, {
        archived: !currentArchived,
      });
      if (res.data?.success) {
        showToast(
          !currentArchived ? t('status.archived') : t('status.all'),
          'info'
        );
        setAssessments((prev) =>
          prev.map((a) => (a.id === assessmentId ? { ...a, archived: !currentArchived } : a))
        );
      }
    } catch (err) {
      showToast(t('errors.generic'), 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [assessmentId]: null }));
    }
  };

  const getSchemeName = (scheme) => {
    if (scheme.translations && scheme.translations[i18n.language]?.name) {
      return scheme.translations[i18n.language].name;
    }
    if (i18n.language === 'te' && scheme.name_te) return scheme.name_te;
    if (i18n.language === 'hi' && scheme.name_hi) return scheme.name_hi;
    return scheme.name;
  };

  const getSchemeBenefit = (scheme) => {
    if (scheme.translations && scheme.translations[i18n.language]?.benefit_summary) {
      return scheme.translations[i18n.language].benefit_summary;
    }
    return scheme.benefit_summary;
  };

  const formatDate = (dateString, withTime = false) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const options = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      };
      return new Intl.DateTimeFormat(i18n.language, options).format(date);
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  const CATEGORY_COLORS = [
    '#059669', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#6366f1', // Indigo
  ];

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

  const categoryChartData = (charts?.category_distribution || []).map((item) => ({
    name: t(`categories.${item.category}`, item.category.replace('_', ' ')),
    schemes: item.count,
  }));

  const readinessPercent = stats?.overall_document_readiness_percent || 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (readinessPercent / 100) * circumference;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden text-start">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t('landing.heroBadge')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t('dashboard.welcomeBack', { name: user?.full_name || 'Citizen' })}
          </h1>
          <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
            {t('dashboard.subtitle')}
          </p>
          <div className="pt-2">
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-emerald-950 bg-amber-400 hover:bg-amber-300 shadow-md transition transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-900" />
              <span>{t('dashboard.startNewAssessment')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-start">
        {/* Total Matches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('dashboard.totalMatches')}
            </p>
            <p className="text-3xl font-extrabold text-slate-900">{stats?.total_matches || 0}</p>
            <Link to="/applications" className="text-xs font-semibold text-emerald-600 hover:underline">
              {t('dashboard.viewAllAssessments')} →
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
              {t('dashboard.applicationsInProgress')}
            </p>
            <p className="text-3xl font-extrabold text-amber-600">
              {stats?.applications_in_progress || 0}
            </p>
            <span className="text-xs text-slate-400">{t('status.inProgress')}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Overall Document Readiness */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('dashboard.overallReadiness')}
            </p>
            <p className="text-3xl font-extrabold text-teal-600">{readinessPercent}%</p>
            <Link to="/documents" className="text-xs font-semibold text-teal-600 hover:underline">
              {t('nav.docTracker')} →
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
              {t('dashboard.totalReadyDocs')}
            </p>
            <p className="text-3xl font-extrabold text-slate-900">
              {stats?.total_ready_documents || 0}
              <span className="text-sm font-normal text-slate-400">
                {' '}
                / {stats?.total_tracked_documents || 16}
              </span>
            </p>
            <span className="text-xs text-slate-400">{t('dashboard.readyDocsRatio', { percent: readinessPercent })}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* DATA VISUALIZATION SECTION: Recharts & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-start">
        {/* 1. Category Distribution Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <span>{t('dashboard.categoryDistributionTitle')}</span>
              </h3>
              <p className="text-xs text-slate-500">{t('landing.whySubtitle')}</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {categoryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {t('dashboard.noApplicationsYet')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="schemes" radius={[6, 6, 0, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. Overall Readiness Ring & Status Funnel */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <span>{t('dashboard.overallReadiness')}</span>
            </h3>
            <p className="text-xs text-slate-500">{t('dashboard.syncNotice')}</p>
          </div>

          {/* SVG Circular Progress Ring */}
          <div className="flex items-center justify-center py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#e2e8f0"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={readinessPercent >= 75 ? '#059669' : readinessPercent >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900">{readinessPercent}%</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t('dashboard.readiness')}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Status Funnel (Saved -> Applying -> Applied) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {t('dashboard.applicationFunnelTitle')}
            </span>
            <div className="space-y-1.5">
              {(charts?.status_funnel || []).map((step) => (
                <div
                  key={step.status}
                  className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                >
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: step.fill }}
                    />
                    {t(`status.${step.status}`, step.label)}
                  </span>
                  <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200">
                    {step.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Schemes Closest to Application-Ready */}
      <div className="space-y-4 text-start">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{t('dashboard.closestToReady')}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <Link
            to="/documents"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
          >
            <span>{t('nav.docTracker')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

        {topSchemes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">{t('dashboard.noApplicationsYet')}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t('dashboard.exploreSchemesPrompt')}
            </p>
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700 cursor-pointer"
            >
              {t('dashboard.startNewAssessment')}
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
                      {t(`categories.${scheme.category}`, scheme.category)}
                    </span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {scheme.match_score}% {t('dashboard.matchScore')}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base line-clamp-2">
                    {getSchemeName(scheme)}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {getSchemeBenefit(scheme)}
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
                    <span>{t('dashboard.viewScheme')}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Assessments History with Quick Rerun & Archive Actions */}
      <div className="space-y-4 text-start">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <span>{t('dashboard.recentAssessmentsTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('assessment.aiNotice')}
            </p>
          </div>
        </div>

        {assessments.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-xs">
            {t('dashboard.noApplicationsYet')}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
            {assessments.map((a) => (
              <div
                key={a.id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {a.language?.toUpperCase() || 'EN'}
                    </span>
                    <span className="text-xs text-slate-500">
                      <strong>{formatDate(a.created_at, true)}</strong>
                    </span>
                    {a.archived && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                        {t('status.archived')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">
                    "{a.situation_text}"
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">{a.ai_summary}</p>
                </div>

                {/* Actions: Re-run AI, Archive, View */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mr-1">
                    {a.matches_count || 0} {t('scheme.schemesCount', { count: a.matches_count || 0 })}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleRerun(a.id, e)}
                    disabled={actionLoading[a.id] === 'rerun'}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                    title={t('assessment.rerunAssessment')}
                  >
                    <RotateCw
                      className={`w-3.5 h-3.5 ${
                        actionLoading[a.id] === 'rerun' ? 'animate-spin text-emerald-600' : ''
                      }`}
                    />
                    <span className="hidden sm:inline">{t('assessment.rerunAssessment')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleToggleArchive(a.id, a.archived, e)}
                    disabled={actionLoading[a.id] === 'archive'}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                    title={a.archived ? t('status.all') : t('status.archived')}
                  >
                    {a.archived ? (
                      <>
                        <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">{t('status.all')}</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">{t('status.archived')}</span>
                      </>
                    )}
                  </button>

                  <Link
                    to={`/assessments/${a.id}`}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
                    title={t('dashboard.viewScheme')}
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
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
