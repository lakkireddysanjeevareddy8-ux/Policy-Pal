import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ReadinessBadge from '../components/ReadinessBadge.jsx';
import {
  Layers,
  Filter,
  ArrowUpDown,
  Search,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';

export default function MyApplicationsPage() {
  const { language, t } = useAuth();
  const { showToast } = useToast();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score'); // 'score' or 'readiness'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/matches', {
        params: {
          q: searchTerm.trim() || undefined,
          status: statusFilter,
          category: categoryFilter,
          sort_by: sortBy,
        },
      });
      if (res.data?.success) {
        setMatches(res.data.data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
      showToast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchMatches();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [statusFilter, categoryFilter, sortBy, searchTerm]);

  const handleStatusChange = async (matchId, newStatus) => {
    try {
      await api.patch(`/matches/${matchId}`, { status: newStatus });
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: newStatus } : m))
      );
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const getSchemeName = (scheme) => {
    if (language === 'te' && scheme.scheme_name_te) return scheme.scheme_name_te;
    if (language === 'hi' && scheme.scheme_name_hi) return scheme.scheme_name_hi;
    return scheme.scheme_name;
  };

  const filteredMatches = matches.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.scheme_name.toLowerCase().includes(term) ||
      (m.scheme_name_te && m.scheme_name_te.toLowerCase().includes(term)) ||
      (m.scheme_name_hi && m.scheme_name_hi.toLowerCase().includes(term)) ||
      m.benefit_summary.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Layers className="w-7 h-7 text-emerald-600" />
          <span>{t('myApplications')}</span>
        </h1>
        <p className="text-sm text-slate-600">
          Track and manage your matched schemes, application states, and document completion
        </p>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search within matched schemes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="saved">Saved</option>
            <option value="applying">Applying (In Progress)</option>
            <option value="applied">Applied</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="agriculture">Agriculture</option>
            <option value="health">Healthcare</option>
            <option value="education">Education</option>
            <option value="housing">Housing</option>
            <option value="finance">Finance</option>
            <option value="employment">Employment</option>
            <option value="social_security">Social Security</option>
            <option value="women_child">Women & Child</option>
          </select>

          {/* Sort By filter */}
          <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setSortBy('score')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                sortBy === 'score'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Score
            </button>
            <button
              onClick={() => setSortBy('readiness')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                sortBy === 'readiness'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Readiness
            </button>
            <button
              onClick={() => setSortBy('date')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                sortBy === 'date'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Date
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
          <h3 className="text-base font-bold text-slate-800">No applications match your filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria or start a new eligibility assessment.
          </p>
          <Link
            to="/assessments/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow hover:bg-emerald-700"
          >
            Start New Assessment
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
                    {m.category}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                    {m.match_score}% Match
                  </span>
                </div>

                <Link
                  to={`/schemes/${m.scheme_slug}`}
                  className="text-base font-bold text-slate-900 hover:text-emerald-700 transition block"
                >
                  {getSchemeName(m)}
                </Link>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {m.benefit_summary}
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
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="saved">Saved</option>
                    <option value="applying">Applying</option>
                    <option value="applied">Applied</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </select>

                  <Link
                    to={`/schemes/${m.scheme_slug}`}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center transition"
                    title="View Scheme Details"
                  >
                    <ArrowRight className="w-4 h-4" />
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
