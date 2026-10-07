import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
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
  Loader2,
} from 'lucide-react';

export default function AssessmentResultPage() {
  const { id } = useParams();
  const { language, t } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

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
        setError('Assessment record not found or access unauthorized.');
      } finally {
        setLoading(false);
      }
    }

    fetchAssessment();
  }, [id]);

  const handleRerun = async () => {
    try {
      setRerunning(true);
      const res = await api.post(`/assessments/${id}/rerun`);
      if (res.data?.success) {
        setAssessment(res.data.data.assessment);
        setMatches(res.data.data.matches || []);
        showToast('Assessment re-evaluated with Gemini AI!', 'success');
      }
    } catch (err) {
      showToast('Failed to rerun assessment. Please try again.', 'error');
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
        showToast(newArchived ? 'Assessment archived' : 'Assessment unarchived', 'info');
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this assessment and its scheme matches?')) {
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/assessments/${id}`);
      showToast('Assessment deleted successfully', 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast('Failed to delete assessment', 'error');
      setDeleting(false);
    }
  };

  const getSchemeName = (scheme) => {
    if (language === 'te' && scheme.scheme_name_te) return scheme.scheme_name_te;
    if (language === 'hi' && scheme.scheme_name_hi) return scheme.scheme_name_hi;
    return scheme.scheme_name;
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
        <h3 className="text-lg font-bold text-slate-900">Assessment Not Found</h3>
        <p className="text-sm text-slate-500">{error || 'This assessment does not exist.'}</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const p = assessment.extracted_profile || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            title="Re-run AI evaluation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${rerunning ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{rerunning ? 'Re-running...' : 'Re-run AI'}</span>
          </button>

          <button
            onClick={handleToggleArchive}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
          >
            {assessment.archived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-amber-600" />
                <span>Unarchive</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>Archive</span>
              </>
            )}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Extracted Profile & Situation Summary Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              Evaluated in {assessment.language?.toUpperCase()}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Citizen Profile & Welfare Evaluation
            </h1>
          </div>
          <span className="text-xs text-slate-400">
            {new Date(assessment.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* User Situation Quote */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm text-slate-700 italic leading-relaxed">
          "{assessment.situation_text}"
        </div>

        {/* Extracted Demographic Fact Badges */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Structured Facts Identified:
          </h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {p.age && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Age: {p.age} yrs
              </span>
            )}
            {p.gender && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200 capitalize">
                Gender: {p.gender}
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
                Income: ₹{Number(p.annual_income).toLocaleString('en-IN')}/yr
              </span>
            )}
            {p.land_holding_acres && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                Land: {p.land_holding_acres} Acres
              </span>
            )}
            {p.social_category && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-900 font-semibold border border-blue-200">
                Category: {p.social_category}
              </span>
            )}
            {p.is_farmer && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                ✓ Farmer
              </span>
            )}
            {p.is_student && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px]">
                ✓ Student
              </span>
            )}
            {p.is_business_owner && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-bold text-[11px]">
                ✓ Micro Enterprise
              </span>
            )}
          </div>
        </div>

        {/* AI Summary Statement */}
        <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl border border-emerald-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Gemini AI Assessment Outlook:</span>
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
              <span>Questions to further refine eligibility:</span>
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
              <span>Eligible Schemes ({matches.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Ranked by compatibility with your demographic and income profile
            </p>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-500 space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm">No schemes met the 50% match score threshold.</p>
            <Link
              to="/assessments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
            >
              Try Another Description
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
                      {m.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs">
                        {m.match_score}% Match
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
                    {m.benefit_summary}
                  </p>

                  {/* AI Eligibility Reason */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
                    <strong>Why you qualify:</strong> {m.eligibility_reason}
                  </div>
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
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <span>View Scheme & Personalized Steps</span>
                    <ArrowRight className="w-4 h-4" />
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
