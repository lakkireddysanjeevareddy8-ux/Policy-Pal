import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Compass,
  Search,
  Building2,
  ArrowRight,
  Filter,
  ExternalLink,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function BrowseSchemesPage() {
  const { language, t } = useAuth();

  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total_pages: 1, total: 0 });

  const categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'agriculture', label: 'Agriculture' },
    { key: 'health', label: 'Health' },
    { key: 'education', label: 'Education' },
    { key: 'housing', label: 'Housing' },
    { key: 'finance', label: 'Finance' },
    { key: 'employment', label: 'Employment' },
    { key: 'social_security', label: 'Social Security' },
    { key: 'women_child', label: 'Women & Child' },
  ];

  const fetchSchemes = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get('/schemes', {
        params: {
          q: searchTerm,
          category,
          level,
          page,
          limit: 12,
        },
      });

      if (res.data?.success) {
        setSchemes(res.data.data.schemes || []);
        setPagination(res.data.data.pagination || { page: 1, limit: 12, total_pages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Error fetching schemes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes(1);
  }, [category, level]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSchemes(1);
  };

  const getSchemeName = (s) => {
    if (language === 'te' && s.name_te) return s.name_te;
    if (language === 'hi' && s.name_hi) return s.name_hi;
    return s.name;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Compass className="w-8 h-8 text-emerald-600" />
          <span>{t('browseSchemes')}</span>
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Explore India's verified central and state welfare catalog. Select any scheme to view
          eligibility criteria, required documents, and official application procedures.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by scheme name, ministry, or benefits..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow transition"
          >
            Search
          </button>
        </form>

        {/* Category Pills & Level Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                  category === c.key
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Level Toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs shrink-0 self-start lg:self-auto">
            <button
              onClick={() => setLevel('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                level === 'all'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Levels
            </button>
            <button
              onClick={() => setLevel('central')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                level === 'central'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Central
            </button>
            <button
              onClick={() => setLevel('state')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                level === 'state'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              State
            </button>
          </div>
        </div>
      </div>

      {/* Schemes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : schemes.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <Compass className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No schemes found</h3>
          <p className="text-xs text-slate-500">Try adjusting your filters or keyword query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schemes.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {s.category}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 capitalize">
                    {s.level} {s.state ? `• ${s.state}` : ''}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                    {getSchemeName(s)}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{s.ministry}</p>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {s.benefit_summary}
                </p>

                {/* Required Document keys tags */}
                {s.required_doc_keys && s.required_doc_keys.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {s.required_doc_keys.slice(0, 3).map((k) => (
                      <span
                        key={k}
                        className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                      >
                        {k.replace('_', ' ')}
                      </span>
                    ))}
                    {s.required_doc_keys.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-bold self-center">
                        +{s.required_doc_keys.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <Link
                  to={`/schemes/${s.slug}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <span>View Details & Steps</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-6">
          <button
            onClick={() => fetchSchemes(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4 text-slate-700" />
          </button>
          <span className="text-xs font-bold text-slate-700">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <button
            onClick={() => fetchSchemes(pagination.page + 1)}
            disabled={pagination.page >= pagination.total_pages}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      )}
    </div>
  );
}
