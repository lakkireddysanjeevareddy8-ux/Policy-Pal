import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ReadinessBadge from '../components/ReadinessBadge.jsx';
import {
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  ListOrdered,
  Building2,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function SchemeDetailPage() {
  const { slug } = useParams();
  const { user, isAuthenticated, language, t } = useAuth();
  const { showToast } = useToast();

  const [scheme, setScheme] = useState(null);
  const [matchRecord, setMatchRecord] = useState(null);
  const [docsState, setDocsState] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [matchStatus, setMatchStatus] = useState('saved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSchemeDetails() {
      try {
        setLoading(true);
        const schemeRes = await api.get(`/schemes/${slug}`);
        if (!schemeRes.data?.success) throw new Error('Scheme not found');

        const s = schemeRes.data.data.scheme;
        setScheme(s);

        if (isAuthenticated) {
          // Fetch user's matches to see if user has an assessment match for this scheme
          const matchesRes = await api.get('/matches');
          const foundMatch = (matchesRes.data?.data?.matches || []).find(
            (m) => m.scheme_slug === slug
          );

          if (foundMatch) {
            setMatchRecord(foundMatch);
            setMatchStatus(foundMatch.status || 'saved');
            setChecklist(foundMatch.ai_checklist || []);
            setDocsState(foundMatch.required_documents || []);
          } else {
            // Fetch user documents state directly
            const docsRes = await api.get('/documents');
            const allUserDocs = docsRes.data?.data?.documents || [];
            const userDocMap = new Map(allUserDocs.map((d) => [d.key, d]));

            const merged = (s.required_documents || []).map((rd) => {
              const ud = userDocMap.get(rd.key);
              return {
                ...rd,
                is_ready: ud ? ud.is_ready : false,
                notes: ud ? ud.notes : null,
              };
            });
            setDocsState(merged);
            setChecklist(
              (s.application_steps || []).map((st) => ({
                step: st.title,
                detail: st.detail,
                done: false,
              }))
            );
          }
        } else {
          setDocsState(s.required_documents || []);
          setChecklist(
            (s.application_steps || []).map((st) => ({
              step: st.title,
              detail: st.detail,
              done: false,
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching scheme details:', err);
        setError('Scheme details could not be loaded.');
      } finally {
        setLoading(false);
      }
    }

    fetchSchemeDetails();
  }, [slug, isAuthenticated]);

  // Toggle document readiness (The Twist: syncs across every scheme that needs this doc)
  const handleToggleDocument = async (docKey) => {
    if (!isAuthenticated) {
      showToast('Please log in to track your documents.', 'info');
      return;
    }

    // Optimistic UI update
    const previousDocs = [...docsState];
    const targetDoc = docsState.find((d) => d.key === docKey);
    const newReadyState = !targetDoc?.is_ready;

    setDocsState((prev) =>
      prev.map((d) => (d.key === docKey ? { ...d, is_ready: newReadyState } : d))
    );

    try {
      await api.put(`/documents/${docKey}`, {
        is_ready: newReadyState,
        notes: targetDoc?.notes || null,
      });
      showToast(
        `${targetDoc?.label || docKey} marked as ${newReadyState ? 'Ready' : 'Not Ready'}. Updated across all your schemes!`,
        'success'
      );
    } catch (err) {
      console.error('Failed to update document status:', err);
      // Rollback on error
      setDocsState(previousDocs);
      showToast('Failed to update document status. Please try again.', 'error');
    }
  };

  // Toggle checklist step
  const handleToggleStep = async (index) => {
    if (!isAuthenticated || !matchRecord) {
      // Toggle locally if guest or not matched
      setChecklist((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, done: !item.done } : item))
      );
      return;
    }

    const previousChecklist = [...checklist];
    const newDoneState = !checklist[index].done;

    setChecklist((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, done: newDoneState } : item))
    );

    try {
      await api.patch(`/matches/${matchRecord.id}/checklist/${index}`, {
        done: newDoneState,
      });
    } catch (err) {
      setChecklist(previousChecklist);
      showToast('Failed to update step progress', 'error');
    }
  };

  // Update application status
  const handleStatusChange = async (newStatus) => {
    if (!isAuthenticated || !matchRecord) return;
    setMatchStatus(newStatus);
    try {
      await api.patch(`/matches/${matchRecord.id}`, { status: newStatus });
      showToast(`Application status updated to ${newStatus}`, 'success');
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const getSchemeName = () => {
    if (!scheme) return '';
    if (language === 'te' && scheme.name_te) return scheme.name_te;
    if (language === 'hi' && scheme.name_hi) return scheme.name_hi;
    return scheme.name;
  };

  const readyDocsCount = docsState.filter((d) => d.is_ready).length;
  const totalDocsCount = docsState.length;
  const readinessPercent = totalDocsCount > 0 ? Math.round((readyDocsCount / totalDocsCount) * 100) : 100;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Scheme Not Found</h3>
        <p className="text-sm text-slate-500">{error || 'This scheme could not be found.'}</p>
        <Link
          to="/schemes"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Browse All Schemes</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          to="/schemes"
          className="text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Schemes Catalog</span>
        </Link>
      </div>

      {/* Main Scheme Hero Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {scheme.category}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                {scheme.level} {scheme.state ? `• ${scheme.state}` : ''}
              </span>
              {matchRecord && (
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  {matchRecord.match_score}% Match Score
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-1">
              {getSchemeName()}
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 pt-0.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{scheme.ministry}</span>
            </p>
          </div>

          {/* Status Dropdown if user has a match */}
          {isAuthenticated && matchRecord && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Application Status:
              </span>
              <select
                value={matchStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="saved">Saved (Planning)</option>
                <option value="applying">Applying (In Progress)</option>
                <option value="applied">Applied (Submitted)</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}
        </div>

        {/* Benefits & Eligibility Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Scheme Benefits & Financial Assistance</span>
            </h3>
            <p className="text-sm text-emerald-950 leading-relaxed font-medium">
              {scheme.benefit_summary}
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <span>Official Eligibility Criteria</span>
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">
              {scheme.eligibility_summary}
            </p>
          </div>
        </div>

        {/* Why user matched callout (if arrived from an assessment) */}
        {matchRecord?.eligibility_reason && (
          <div className="p-4 bg-teal-50 rounded-2xl border border-teal-200 text-xs text-teal-950 space-y-1">
            <strong className="text-teal-900 font-bold block">Why You Specifically Qualify:</strong>
            <p className="leading-relaxed">{matchRecord.eligibility_reason}</p>
          </div>
        )}

        {/* Official Portal Link & Indicative Notice */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Last verified on official registry: {scheme.last_verified}</span>
          </span>

          <a
            href={scheme.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow transition flex items-center justify-center gap-2"
          >
            <span>Visit Official Government Portal</span>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Two Column Layout: Shared Documents Tracker vs. Personalized Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Required Documents Checklist (The Twist) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <span>Required Documents</span>
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {readyDocsCount} / {totalDocsCount} Ready
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Tick documents you already have. Changes automatically sync to every scheme that needs them.
            </p>
          </div>

          {/* Readiness Progress Bar */}
          <ReadinessBadge
            readyCount={readyDocsCount}
            totalCount={totalDocsCount}
            percentage={readinessPercent}
          />

          {/* Interactive Document List */}
          <div className="space-y-2.5 pt-2">
            {docsState.map((doc) => (
              <div
                key={doc.key}
                onClick={() => handleToggleDocument(doc.key)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                  doc.is_ready
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {doc.is_ready ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-bold ${
                        doc.is_ready ? 'text-emerald-950' : 'text-slate-800'
                      }`}
                    >
                      {doc.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        doc.is_ready
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {doc.is_ready ? 'Ready' : 'Needed'}
                    </span>
                  </div>
                  {doc.where_to_get && (
                    <p className="text-xs text-slate-500 leading-snug">
                      <strong>Where to get:</strong> {doc.where_to_get}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Personalized Step-by-Step Checklist */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-teal-600" />
              <span>Application Checklist</span>
            </h3>
            <p className="text-xs text-slate-500">
              {matchRecord
                ? 'AI-personalized procedure tailored to your profile.'
                : 'Standard official procedure to apply for this scheme.'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {checklist.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleToggleStep(idx)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                  item.done
                    ? 'bg-emerald-50/50 border-emerald-300 opacity-90'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {item.done ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        item.done ? 'line-through text-slate-500' : 'text-slate-900'
                      }`}
                    >
                      {item.step}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 pl-7 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
