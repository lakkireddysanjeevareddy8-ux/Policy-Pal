import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  FileCheck2,
  CheckSquare,
  Square,
  Save,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';

export default function DocumentTrackerPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocForSchemes, setSelectedDocForSchemes] = useState(null);

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('documents.trackerTitle')}`;
  }, [t]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents', {
        params: { lang: i18n.language },
      });
      if (res.data?.success) {
        setDocuments(res.data.data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      showToast(t('errors.serverError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [i18n.language]);

  const handleToggleReady = async (docKey) => {
    const doc = documents.find((d) => d.key === docKey);
    if (!doc) return;

    const newReadyState = !doc.is_ready;
    const previousDocs = [...documents];

    setDocuments((prev) =>
      prev.map((d) => (d.key === docKey ? { ...d, is_ready: newReadyState } : d))
    );

    try {
      await api.put(`/documents/${docKey}`, {
        is_ready: newReadyState,
        notes: doc.notes,
      });
      const docName = t(`documents.names.${docKey}`, doc.label);
      showToast(
        `${docName} -> ${newReadyState ? t('status.ready') : t('status.notReady')}`,
        'success'
      );
    } catch (err) {
      console.error('Error updating document ready state:', err);
      setDocuments(previousDocs);
      showToast(t('errors.generic'), 'error');
    }
  };

  const handleNotesChange = (docKey, newNotes) => {
    setDocuments((prev) =>
      prev.map((d) => (d.key === docKey ? { ...d, notes: newNotes, isDirtyNotes: true } : d))
    );
  };

  const handleSaveNotes = async (docKey) => {
    const doc = documents.find((d) => d.key === docKey);
    if (!doc) return;

    try {
      await api.put(`/documents/${docKey}`, {
        is_ready: doc.is_ready,
        notes: doc.notes,
      });
      setDocuments((prev) =>
        prev.map((d) => (d.key === docKey ? { ...d, isDirtyNotes: false } : d))
      );
      showToast(t('profile.saveSuccess'), 'success');
    } catch (err) {
      showToast(t('errors.generic'), 'error');
    }
  };

  const getDocTitle = (doc) => {
    return t(`documents.names.${doc.key}`, doc.label);
  };

  const readyCount = documents.filter((d) => d.is_ready).length;
  const totalCount = documents.length;
  const overallPercent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  const filteredDocs = documents.filter((d) => {
    if (filterState === 'ready' && !d.is_ready) return false;
    if (filterState === 'missing' && d.is_ready) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const localizedTitle = getDocTitle(d).toLowerCase();
      return (
        localizedTitle.includes(term) ||
        d.label.toLowerCase().includes(term) ||
        (d.notes && d.notes.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-start">
      {/* Header with Explanation of The Twist */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('landing.heroBadge')}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-7 h-7 text-emerald-600" />
          <span>{t('documents.trackerTitle')}</span>
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          {t('documents.trackerSubtitle')}
        </p>
      </div>

      {/* Global Readiness Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('dashboard.overallReadiness')}
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              {t('documents.readyCount', { count: readyCount, total: totalCount })} ({overallPercent}%)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-extrabold text-emerald-600">{overallPercent}%</span>
          </div>
        </div>

        {/* Big Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 transition-all duration-700"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('common.search')}
            className="w-full ps-9 pe-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setFilterState('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                filterState === 'all'
                  ? 'bg-white text-slate-900 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('documents.filterAll')} ({totalCount})
            </button>
            <button
              onClick={() => setFilterState('ready')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                filterState === 'ready'
                  ? 'bg-white text-emerald-800 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('documents.filterReady', { count: readyCount })}
            </button>
            <button
              onClick={() => setFilterState('missing')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                filterState === 'missing'
                  ? 'bg-white text-rose-800 shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('documents.filterMissing', { count: totalCount - readyCount })}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Documents */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-500 text-sm">
          {t('documents.noDocsFound')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.key}
              className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                doc.is_ready
                  ? 'bg-emerald-50/40 border-emerald-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-3">
                {/* Header row: Checkbox, Title, and Cross-Scheme Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => handleToggleReady(doc.key)}
                    className="flex items-start gap-3 cursor-pointer select-none group"
                  >
                    <div className="shrink-0 mt-0.5">
                      {doc.is_ready ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition" />
                      )}
                    </div>
                    <div>
                      <h3
                        className={`text-base font-bold leading-tight ${
                          doc.is_ready ? 'text-emerald-950' : 'text-slate-900'
                        }`}
                      >
                        {getDocTitle(doc)}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-400 font-mono">
                        {doc.key}
                      </span>
                    </div>
                  </div>

                  {/* "Used by N of your schemes" Badge */}
                  {doc.schemes_count > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDocForSchemes(doc)}
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition flex items-center gap-1 shadow-xs cursor-pointer"
                      title={t('documents.sharedAcrossSchemes', { count: doc.schemes_count })}
                    >
                      <Layers className="w-3 h-3 text-amber-700" />
                      <span>{t('documents.sharedAcrossSchemes', { count: doc.schemes_count })}</span>
                    </button>
                  )}
                </div>

                {/* Where to get explanation */}
                {doc.where_to_get && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-relaxed">
                    {doc.where_to_get}
                  </p>
                )}
              </div>

              {/* Personal Notes & Quick Save */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={doc.notes || ''}
                  onChange={(e) => handleNotesChange(doc.key, e.target.value)}
                  placeholder={t('common.edit') + ' notes...'}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {doc.isDirtyNotes && (
                  <button
                    type="button"
                    onClick={() => handleSaveNotes(doc.key)}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    title={t('common.save')}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for "Used by N Schemes" */}
      {selectedDocForSchemes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  {t('documents.crossSchemeNotice')}
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {getDocTitle(selectedDocForSchemes)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDocForSchemes(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t('documents.howItWorksNotice')}
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(selectedDocForSchemes.schemes_using || []).map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-bold text-slate-800">{s.name}</span>
                  <Link
                    to={`/schemes/${s.slug}`}
                    className="text-emerald-600 hover:text-emerald-700 font-bold text-xs shrink-0"
                  >
                    {t('dashboard.viewScheme')} →
                  </Link>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedDocForSchemes(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
