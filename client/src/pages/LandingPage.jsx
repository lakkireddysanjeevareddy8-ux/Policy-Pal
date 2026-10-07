import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Sparkles,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Award,
  Users,
  Building2,
  Compass,
} from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, t } = useAuth();
  const navigate = useNavigate();
  const [demoAadhaarChecked, setDemoAadhaarChecked] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-semibold border border-emerald-200 shadow-sm animate-pulse">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>AI-Powered Government Welfare Discovery for Indian Citizens</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Discover Schemes You Are Eligible For in{' '}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 bg-clip-text text-transparent">
                Plain Language
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Describe your situation in English, Telugu (తెలుగు), or Hindi (हिन्दी).
              Our AI matches you against curated Central and State schemes and prepares
              your tailored application checklist.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                to={isAuthenticated ? '/assessments/new' : '/register'}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-base text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <span>Check Your Eligibility Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                to="/schemes"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-semibold text-base text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-sm transition flex items-center justify-center gap-2"
              >
                <Compass className="w-5 h-5 text-slate-500" />
                <span>Browse Scheme Catalog</span>
              </Link>
            </div>

            {/* Quick stats banner */}
            <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-2xl font-extrabold text-slate-900">20+</p>
                <p className="text-xs text-slate-500 font-medium">Curated National Schemes</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-2xl font-extrabold text-emerald-600">3</p>
                <p className="text-xs text-slate-500 font-medium">Languages (EN, TE, HI)</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-2xl font-extrabold text-amber-600">16</p>
                <p className="text-xs text-slate-500 font-medium">Shared Document Types</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-2xl font-extrabold text-teal-600">100%</p>
                <p className="text-xs text-slate-500 font-medium">Free Citizen Service</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Twist: Interactive Document Readiness Tracker Demonstration */}
      <section className="py-16 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              The PolicyPal Twist
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              One Document. Synchronized Across Every Scheme.
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              Documents are shared across all government schemes. When you mark your Aadhaar or
              Bank Passbook as ready once, the readiness progress bar updates across every single
              scheme that requires it. Try it below:
            </p>
          </div>

          {/* Interactive Live Demo Card */}
          <div className="max-w-4xl mx-auto bg-slate-800/90 rounded-2xl p-6 sm:p-8 border border-slate-700 shadow-2xl backdrop-blur-md">
            {/* Interactive Toggle Control */}
            <div className="bg-slate-700/60 p-4 rounded-xl border border-slate-600 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">Aadhaar Card</h4>
                  <p className="text-xs text-slate-400">UIDAI 12-digit Biometric ID</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-300">
                  Status:{' '}
                  <strong className={demoAadhaarChecked ? 'text-emerald-400' : 'text-rose-400'}>
                    {demoAadhaarChecked ? 'Ready (Available)' : 'Missing (Not Ready)'}
                  </strong>
                </span>
                <button
                  onClick={() => setDemoAadhaarChecked(!demoAadhaarChecked)}
                  className={`px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 ${
                    demoAadhaarChecked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Toggle Aadhaar State</span>
                </button>
              </div>
            </div>

            {/* Scheme cards demonstrating instant sync */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* PM-KISAN */}
              <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Agriculture
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">Central</span>
                </div>
                <h4 className="font-bold text-white text-sm">PM-KISAN</h4>
                <p className="text-xs text-slate-400 line-clamp-2">
                  ₹6,000 yearly income support for farmers
                </p>

                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Readiness:</span>
                    <span className="font-bold text-emerald-400">
                      {demoAadhaarChecked ? '4 of 4 docs (100%)' : '3 of 4 docs (75%)'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: demoAadhaarChecked ? '100%' : '75%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Ayushman Bharat PM-JAY */}
              <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                    Health
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">Central</span>
                </div>
                <h4 className="font-bold text-white text-sm">Ayushman Bharat</h4>
                <p className="text-xs text-slate-400 line-clamp-2">
                  ₹5 Lakh annual cashless healthcare
                </p>

                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Readiness:</span>
                    <span className="font-bold text-emerald-400">
                      {demoAadhaarChecked ? '3 of 3 docs (100%)' : '2 of 3 docs (67%)'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: demoAadhaarChecked ? '100%' : '67%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Rythu Bandhu */}
              <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    State
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">Telangana</span>
                </div>
                <h4 className="font-bold text-white text-sm">Rythu Bandhu</h4>
                <p className="text-xs text-slate-400 line-clamp-2">
                  ₹10,000/acre yearly investment grant
                </p>

                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Readiness:</span>
                    <span className="font-bold text-emerald-400">
                      {demoAadhaarChecked ? '4 of 4 docs (100%)' : '3 of 4 docs (75%)'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: demoAadhaarChecked ? '100%' : '75%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 className="text-3xl font-extrabold text-slate-900">How PolicyPal Works</h2>
          <p className="text-slate-600">3 simple steps to find and apply for government schemes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h3 className="text-xl font-bold text-slate-900">Tell Your Situation</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Describe your age, occupation, family size, landholding, or financial goals in
              simple English, Telugu, or Hindi. No confusing legal jargon.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h3 className="text-xl font-bold text-slate-900">AI Matches & Ranks</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Google Gemini evaluates verified Central and State scheme rules, giving you match
              scores, exact reasons for eligibility, and missing requirements.
            </p>
          </div>

          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h3 className="text-xl font-bold text-slate-900">Track & Apply</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Use your unified Document Tracker to see which scheme is closest to 100% ready.
              Follow step-by-step checklists to submit on official portals.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-emerald-700 py-16 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Discover Your Benefits?
          </h2>
          <p className="text-emerald-100 text-base sm:text-lg max-w-xl mx-auto">
            Try with our instant demo account or register in under 30 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-emerald-900 bg-white hover:bg-slate-100 shadow-lg transition"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white bg-emerald-800 hover:bg-emerald-900 border border-emerald-600 transition"
            >
              {t('demoLogin')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
