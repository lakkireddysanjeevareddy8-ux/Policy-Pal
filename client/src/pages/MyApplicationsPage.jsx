import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ReadinessBadge from '../components/ReadinessBadge.jsx';
import {
  Layers,
  Search,
  ArrowRight,
} from 'lucide-react';

export default function MyApplicationsPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('nav.myApplications')}`;
  }, [t]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/matches', {
        params: {
          q: searchTerm.trim() || undefined,
          status: statusFilter,
          category: categoryFilter,
          sort_by: sortBy,
          lang: i18n.language,
        },
      });
      if (res.data?.success) {
        setMatches(res.data.data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
      showToast(t('errors.serverError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchMatches();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [statusFilter, categoryFilter, sortBy, searchTerm, i18n.language]);

  const handleStatusChange = async (matchId, newStatus) => {
    try {
      await api.patch(`/matches/${matchId}`, { status: newStatus });
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: newStatus } : m))
      );
      showToast(`${t('scheme.applicationStatus')}: ${t(`status.${newStatus}`)}`, 'success');
    } catch (err) {
      showToast(t('errors.generic'), 'error');
    }
  };

  const getSchemeName = (scheme) => {
    if (scheme.translations && scheme.translations[i18n.language]?.name) {
      return scheme.translations[i18n.language].name;
    }
    if (i18n.language === 'te' && scheme.scheme_name_te) return scheme.scheme_name_te;
    if (i18n.language === 'hi' && scheme.scheme_name_hi) return scheme.scheme_name_hi;
    return scheme.scheme_name || scheme.name;
  };

  const getSchemeBenefit = (scheme) => {
    if (scheme.translations && scheme.translations[i18n.language]?.benefit_summary) {
      return scheme.translations[i18n.language].benefit_summary;
    }
    return scheme.benefit_summary;
  };

  const filteredMatches = matches.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = getSchemeName(m).toLowerCase();
    return (
      name.includes(term) ||
      m.scheme_name.toLowerCase().includes(term) ||
      (m.benefit_summary && m.benefit_summary.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-start">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Layers className="w-7 h-7 text-emerald-600" />
          <span>{t('nav.myApplications')}</span>
        </h1>
        <p className="text-sm text-slate-600">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('scheme.searchPlaceholder')}
            className="w-full ps-9 pe-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">{t('status.all')}</option>
            <option value="saved">{t('status.saved')}</option>
            <option value="applying">{t('status.applying')}</option>
            <option value="applied">{t('status.applied')}</option>
            <option value="rejected">{t('status.rejected')}</option>
            <option value="archived">{t('status.archived')}</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">{t('categories.all')}</option>
            <option value="agriculture">{t('categories.agriculture')}</option>
            <option value="health">{t('categories.health')}</option>
            <option value="education">{t('categories.education')}</option>
            <option value="housing">{t('categories.housing')}</option>
            <option value="finance">{t('categories.finance')}</option>
            <option value="employment">{t('categories.employment')}</option>
            <option value="social_security">{t('categories.social_security')}</option>
            <option value="women_child">{t('categories.women_child')}</option>
          </select>

          {/* Sort By filter */}
          <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setSortBy('score')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                sortBy === 'score'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('dashboard.matchScore')}
            </button>
            <button
              onClick={() => setSortBy('readiness')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                sortBy === 'readiness'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('dashboard.readiness')}
            </button>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
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
        <div className="space-y-4">
          {filteredMatches.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            >
              {/* Scheme Summary */}
              <div className="space-y-2 flex-1 max-w-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {t(`categories.${m.category}`, m.category)}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                    {m.match_score}% {t('dashboard.matchScore')}
                  </span>
                </div>

                <Link
                  to={`/schemes/${m.scheme_slug}`}
                  className="text-base font-bold text-slate-900 hover:text-emerald-700 transition block"
                >
                  {getSchemeName(m)}
                </Link>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {getSchemeBenefit(m)}
                </p>
              </div>

              {/* Document Readiness & Status controls */}
              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-4 shrink-0 w-full md:w-auto">
                <div className="w-full sm:w-48">
                  <ReadinessBadge
                    readyCount={m.ready_docs_count}
                    totalCount={m.total_docs_count}
                    percentage={m.readiness_percent}
                    size="sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Dropdown */}
                  <select
                    value={m.status}
                    onChange={(e) => handleStatusChange(m.id, e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="saved">{t('status.saved')}</option>
                    <option value="applying">{t('status.applying')}</option>
                    <option value="applied">{t('status.applied')}</option>
                    <option value="rejected">{t('status.rejected')}</option>
                    <option value="archived">{t('status.archived')}</option>
                  </select>

                  <Link
                    to={`/schemes/${m.scheme_slug}`}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center transition cursor-pointer"
                    title={t('dashboard.viewScheme')}
                  >
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
