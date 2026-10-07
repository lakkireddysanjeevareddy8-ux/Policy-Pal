import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  Sparkles,
  Send,
  Loader2,
  Globe,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function NewAssessmentPage() {
  const { language: currentLang, setLanguage, t } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [situationText, setSituationText] = useState('');
  const [assessmentLang, setAssessmentLang] = useState(currentLang || 'en');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const MAX_CHARS = 2000;

  const examplePrompts = [
    {
      label: '🌾 Small Farmer in Telangana',
      text: 'I am a 42-year-old small farmer living in Rangareddy, Telangana. I have 2.5 acres of dry land where I cultivate cotton and maize. My annual family income is around ₹1.8 Lakhs. My family consists of 4 members including two school-going children. I want financial support for farming inputs and affordable health coverage for my family.',
      lang: 'en',
    },
    {
      label: '🎓 OBC Engineering Student',
      text: 'I am a 21-year-old college student from rural Andhra Pradesh studying B.Tech in Computer Science. My parents are daily wage laborers with an annual income under ₹1.5 Lakhs. We belong to the OBC category. I am looking for tuition fee reimbursement and post-matric scholarship support.',
      lang: 'en',
    },
    {
      label: '🧵 చేతివృత్తుల నేత కార్మికుడు (Telugu)',
      text: 'నా వయస్సు 38 సంవత్సరాలు. నేను తెలంగాణలోని సిరిసిల్ల ప్రాంతంలో చేనేత మగ్గం నడుపుతున్నాను. నా వార్షిక ఆదాయం దాదాపు ₹1.4 లక్షలు. నా కుటుంబంలో 4 మంది ఉన్నారు. మా వ్యాపార విస్తరణకు ముద్ర లేదా చేనేత కార్మికుల ప్రభుత్వ రుణ పథకాలు కావాలి.',
      lang: 'te',
    },
    {
      label: '🛒 लघु उद्यमी / फेरीवाला (Hindi)',
      text: 'मेरी उम्र 34 वर्ष है और मैं लखनऊ में पिछले 5 वर्षों से फल और सब्जियों की रेहड़ी (स्ट्रीट वेंडर) लगाता हूँ। मेरी वार्षिक पारिवारिक आय लगभग ₹1.2 लाख है। मुझे अपने ठेले के विस्तार हेतु बिना गारंटी के आसान ब्याज दर पर सरकारी ऋण की आवश्यकता है।',
      lang: 'hi',
    },
  ];

  const handleChipClick = (example) => {
    setSituationText(example.text);
    setAssessmentLang(example.lang);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (situationText.trim().length < 10) {
      setErrorMsg('Please describe your situation in at least 10 characters.');
      return;
    }

    if (situationText.length > MAX_CHARS) {
      setErrorMsg(`Description exceeds maximum allowed limit of ${MAX_CHARS} characters.`);
      return;
    }

    setLoading(true);
    setLoadingStage(1);

    // Dynamic stage updates for engaging loading state
    const stageTimer1 = setTimeout(() => setLoadingStage(2), 1200);
    const stageTimer2 = setTimeout(() => setLoadingStage(3), 2800);

    try {
      const res = await api.post('/assessments', {
        situation_text: situationText,
        language: assessmentLang,
      });

      if (res.data?.success) {
        showToast('Assessment generated successfully!', 'success');
        navigate(`/assessments/${res.data.data.assessment.id}`);
      }
    } catch (err) {
      console.error('Assessment generation failed:', err);
      const message =
        err.response?.data?.error?.message ||
        'Failed to generate assessment. Please check your text and try again.';
      setErrorMsg(message);
      showToast(message, 'error');
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Gemini AI Welfare Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Check Scheme Eligibility
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          Describe your household, occupation, income, and welfare needs in everyday words.
          Our model will extract your demographic profile and match you against official central and
          state programs.
        </p>
      </div>

      {/* Interactive Example Chips */}
      <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>Quick Example Scenarios (Click to test instantly):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((example, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(example)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-sm transition"
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
                <span>Response Language</span>
              </label>
              <p className="text-xs text-slate-500">
                AI will explain eligibility and write checklists in this language
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setAssessmentLang('en')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  assessmentLang === 'en'
                    ? 'bg-white text-emerald-800 shadow font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setAssessmentLang('te')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  assessmentLang === 'te'
                    ? 'bg-white text-emerald-800 shadow font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                తెలుగు (Telugu)
              </button>
              <button
                type="button"
                onClick={() => setAssessmentLang('hi')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  assessmentLang === 'hi'
                    ? 'bg-white text-emerald-800 shadow font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी (Hindi)
              </button>
            </div>
          </div>

          {/* Textarea Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Your Situation & Background
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
              placeholder="e.g. I am a 35-year-old small farmer living in Telangana. I cultivate 2 acres of land with my family of 4. My annual family income is ₹1.5 Lakhs. I need support for agriculture inputs and affordable hospital care..."
              className="w-full p-4 rounded-2xl border border-slate-300 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-inner resize-y"
            />
          </div>

          {/* Loading Stage Display */}
          {loading && (
            <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                <h4 className="text-sm font-bold text-emerald-900">
                  Processing with Gemini AI...
                </h4>
              </div>

              <div className="space-y-2 text-xs font-medium text-emerald-800 pl-8">
                <div
                  className={`flex items-center gap-2 ${
                    loadingStage >= 1 ? 'text-emerald-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>1. Parsing profile facts (age, occupation, income, landholding)</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    loadingStage >= 2 ? 'text-emerald-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>2. Matching against curated central & state scheme guidelines</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    loadingStage >= 3 ? 'text-emerald-900 font-bold' : 'text-slate-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>3. Building personalized application step-by-step checklists</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || situationText.trim().length === 0}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Find My Schemes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
