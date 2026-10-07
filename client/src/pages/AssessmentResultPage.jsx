import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ReadinessBadge from '../components/ReadinessBadge.jsx';
import {
  Sparkles,
  ArrowRight,
  RotateCw,
  Archive,
  ArchiveRestore,
  Trash2,
  HelpCircle,
  CheckCircle2,
  User,
  MapPin,
  Briefcase,
  IndianRupee,
  Layers,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

export default function AssessmentResultPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('assessment.resultTitle')}`;
  }, [t]);

  useEffect(() => {
    async function fetchAssessment() {
      try {
        setLoading(true);
        const res = await api.get(`/assessments/${id}`);
        if (res.data?.success) {
          setAssessment(res.data.data.assessment);
          setMatches(res.data.data.matches || []);
        }
      } catch (err) {
        console.error('Failed to load assessment:', err);
        setError(t('errors.notFound'));
      } finally {
        setLoading(false);
      }
    }

    fetchAssessment();
  }, [id, t]);

  const handleRerun = async () => {
    try {
      setRerunning(true);
      const res = await api.post(`/assessments/${id}/rerun`);
      if (res.data?.success) {
        setAssessment(res.data.data.assessment);
        setMatches(res.data.data.matches || []);
        showToast(t('assessment.aiNotice'), 'success');
      }
    } catch (err) {
      showToast(t('errors.aiUnavailable'), 'error');
    } finally {
      setRerunning(false);
    }
  };

  const handleToggleArchive = async () => {
    try {
      const newArchived = !assessment.archived;
      const res = await api.patch(`/assessments/${id}`, { archived: newArchived });
      if (res.data?.success) {
        setAssessment((prev) => ({ ...prev, archived: newArchived }));
        showToast(newArchived ? t('status.archived') : t('status.all'), 'info');
      }
    } catch (err) {
      showToast(t('errors.generic'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('common.confirm') + '?')) {
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/assessments/${id}`);
      showToast(t('common.delete'), 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast(t('errors.generic'), 'error');
      setDeleting(false);
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        <div className="h-40 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">{t('errors.notFound')}</h3>
        <p className="text-sm text-slate-500">{error || t('common.pageNotFoundDesc')}</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('common.back')}</span>
        </Link>
      </div>
    );
  }

  const p = assessment.extracted_profile || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-start">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('dashboard.title')}</span>
        </Link>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            title={t('assessment.rerunAssessment')}
          >
            <RotateCw className={`w-3.5 h-3.5 ${rerunning ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{rerunning ? t('common.loading') : t('assessment.rerunAssessment')}</span>
          </button>

          <button
            onClick={handleToggleArchive}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            {assessment.archived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" />
                <span>{t('status.all')}</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('status.archived')}</span>
              </>
            )}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>{t('common.delete')}</span>
          </button>
        </div>
      </div>

      {/* Extracted Profile & Situation Summary Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              {t('assessment.aiSourceTag')} ({assessment.language?.toUpperCase()})
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {t('assessment.citizenProfileTitle')}
            </h1>
          </div>
          <span className="text-xs text-slate-400">
            {formatDate(assessment.created_at)}
          </span>
        </div>

        {/* User Situation Quote */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm text-slate-700 italic leading-relaxed">
          "{assessment.situation_text}"
        </div>

        {/* Extracted Demographic Fact Badges */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t('assessment.citizenProfileTitle')}:
          </h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {p.age && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {t('assessment.age')}: {p.age}
              </span>
            )}
            {p.gender && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200 capitalize">
                {t('assessment.gender')}: {p.gender}
              </span>
            )}
            {p.state && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {p.state} {p.district ? `(${p.district})` : ''}
              </span>
            )}
            {p.occupation && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                {p.occupation}
              </span>
            )}
            {p.annual_income && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
                {t('assessment.income')}: ₹{Number(p.annual_income).toLocaleString('en-IN')}
              </span>
            )}
            {p.land_holding_acres && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                {t('assessment.landHolding')}: {p.land_holding_acres} {t('assessment.acresUnit')}
              </span>
            )}
            {p.social_category && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-900 font-semibold border border-blue-200">
                {p.social_category}
              </span>
            )}
            {p.is_farmer && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                ✓ {t('assessment.farmer')}
              </span>
            )}
            {p.is_student && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px]">
                ✓ {t('assessment.student')}
              </span>
            )}
            {p.is_business_owner && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-bold text-[11px]">
                ✓ {t('assessment.businessOwner')}
              </span>
            )}
          </div>
        </div>

        {/* AI Summary Statement */}
        <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl border border-emerald-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{t('assessment.resultTitle')}</span>
          </div>
          <p className="text-sm text-emerald-950 leading-relaxed font-medium">
            {assessment.ai_summary}
          </p>
        </div>

        {/* Missing Info Questions */}
        {assessment.missing_info && assessment.missing_info.length > 0 && (
          <div className="bg-amber-50/80 p-4 sm:p-5 rounded-2xl border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>{t('assessment.refineAssessment')}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-950">
              {assessment.missing_info.map((q, idx) => (
                <li key={idx} className="leading-relaxed">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Matched Schemes Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span>{t('assessment.matchedSchemesTitle')} ({matches.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('scheme.subtitle')}
            </p>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-500 space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm">{t('assessment.noMatchesFound')}</p>
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              {t('assessment.rerunAssessment')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Category & Match Score Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {t(`categories.${m.category}`, m.category)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs">
                        {m.match_score}% {t('dashboard.matchScore')}
                      </span>
                    </div>
                  </div>

                  {/* Title & Ministry */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-2">
                      {getSchemeName(m)}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{m.ministry}</p>
                  </div>

                  {/* Benefits summary */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {getSchemeBenefit(m)}
                  </p>

                  {/* AI Eligibility Reason */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
                    <strong>{t('assessment.eligibilityReason')}:</strong> {m.eligibility_reason}
                  </div>

                  {/* Assumptions to Confirm (Hallucination Guard) */}
                  {m.assumptions_to_confirm && m.assumptions_to_confirm.length > 0 && (
                    <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{t('assessment.pleaseConfirm')}:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900">
                        {m.assumptions_to_confirm.map((item, idx) => (
                          <li key={idx} className="leading-snug">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Shared Document Readiness & Action */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <ReadinessBadge
                    readyCount={m.ready_docs_count}
                    totalCount={m.total_docs_count}
                    percentage={m.readiness_percent}
                  />

                  <Link
                    to={`/schemes/${m.scheme_slug}`}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t('dashboard.viewScheme')}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
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
