import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { SUPPORTED_LANGUAGES } from '../i18n/languages.js';
import {
  Sparkles,
  Loader2,
  Globe,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';

export default function NewAssessmentPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [situationText, setSituationText] = useState('');
  const [assessmentLang, setAssessmentLang] = useState(i18n.language || 'en');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const MAX_CHARS = 2000;

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('assessment.newCheckTitle')}`;
  }, [t]);

  // Keep assessment language in sync if UI language changes, unless manually modified
  useEffect(() => {
    if (i18n.language) {
      setAssessmentLang(i18n.language);
    }
  }, [i18n.language]);

  const examplePrompts = [
    {
      label: '🌾 ' + t('assessment.example1').substring(0, 30) + '...',
      text: t('assessment.example1'),
    },
    {
      label: '🎓 ' + t('assessment.example2').substring(0, 30) + '...',
      text: t('assessment.example2'),
    },
    {
      label: '🧵 ' + t('assessment.example3').substring(0, 30) + '...',
      text: t('assessment.example3'),
    },
  ];

  const handleChipClick = (example) => {
    setSituationText(example.text);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (situationText.trim().length < 10) {
      setErrorMsg(t('errors.validationFailed'));
      return;
    }

    if (situationText.length > MAX_CHARS) {
      setErrorMsg(`Description exceeds limit of ${MAX_CHARS} characters.`);
      return;
    }

    setLoading(true);
    setLoadingStage(1);

    const stageTimer1 = setTimeout(() => setLoadingStage(2), 1500);
    const stageTimer2 = setTimeout(() => setLoadingStage(3), 3200);

    try {
      const res = await api.post('/assessments', {
        situation_text: situationText,
        language: assessmentLang,
      });

      if (res.data?.success) {
        showToast(t('assessment.resultTitle'), 'success');
        navigate(`/assessments/${res.data.data.assessment.id}`);
      }
    } catch (err) {
      console.error('Assessment generation failed:', err);
      const errCode = err.response?.data?.error?.code;
      let message = t('errors.serverError');
      if (errCode === 'AI_UNAVAILABLE') {
        message = t('errors.aiUnavailable');
      } else if (errCode === 'RATE_LIMIT_EXCEEDED') {
        message = t('errors.rateLimited');
      } else if (err.response?.data?.error?.message) {
        message = err.response.data.error.message;
      }
      setErrorMsg(message);
      showToast(message, 'error');
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-start">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('landing.heroBadge')}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('assessment.newCheckTitle')}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          {t('assessment.newCheckSubtitle')}
        </p>
      </div>

      {/* Interactive Example Chips */}
      <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>{t('assessment.examplePromptsLabel')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((example, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(example)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-sm transition cursor-pointer"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Input Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Language Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>{t('assessment.languageLabel')}</span>
              </label>
              <p className="text-xs text-slate-500">
                {t('landing.step1Desc')}
              </p>
            </div>

            <div className="w-full sm:w-64">
              <select
                value={assessmentLang}
                onChange={(e) => setAssessmentLang(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Textarea Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t('landing.describeSituation')}
              </label>
              <span
                className={`text-xs font-medium ${
                  situationText.length > MAX_CHARS - 100
                    ? 'text-rose-600 font-bold'
                    : 'text-slate-400'
                }`}
              >
                {situationText.length} / {MAX_CHARS}
              </span>
            </div>

            <textarea
              rows={7}
              required
              disabled={loading}
              value={situationText}
              onChange={(e) => setSituationText(e.target.value)}
              placeholder={t('assessment.promptPlaceholder')}
              className="w-full p-4 rounded-2xl border border-slate-300 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-inner resize-y"
            />
          </div>

          {/* Loading Stage Display */}
          {loading && (
            <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                <h4 className="text-sm font-bold text-emerald-900">
                  {t('assessment.analyzingButton')}
                </h4>
              </div>

              <div className="space-y-2 text-xs font-medium text-emerald-800 ps-8">
                <div
                  className={`flex items-center gap-2 ${
                    loadingStage >= 1 ? 'text-emerald-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span>{t('landing.step1Title')} - {t('assessment.citizenProfileTitle')}</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    loadingStage >= 2 ? 'text-emerald-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span>{t('landing.step2Title')} - {t('assessment.matchedSchemesTitle')}</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    loadingStage >= 3 ? 'text-emerald-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span>{t('landing.step3Title')} - {t('assessment.checklistTitle')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || situationText.trim().length === 0}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('assessment.analyzingButton')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{t('assessment.submitButton')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
