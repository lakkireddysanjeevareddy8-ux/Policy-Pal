import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ExternalLink, Heart, Award } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../i18n/languages.js';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-slate-900 text-slate-300 mt-auto border-t border-slate-800 text-start">
      {/* Indicative Disclaimer Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center text-xs sm:text-sm font-medium text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            {t('common.disclaimer')}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                PP
              </div>
              <span className="font-bold text-lg text-white">PolicyPal</span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>{t('landing.whySubtitle')}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              {t('scheme.officialPortal')}
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a
                  href="https://www.myscheme.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition flex items-center gap-1.5"
                >
                  myScheme Portal <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.india.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition flex items-center gap-1.5"
                >
                  National Portal of India <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://uidai.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition flex items-center gap-1.5"
                >
                  UIDAI (Aadhaar) <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://scholarships.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 transition flex items-center gap-1.5"
                >
                  National Scholarship Portal <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>

          {/* Language & Support */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              {t('landing.whyFeature2Title')}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              {t('landing.whyFeature2Desc')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_LANGUAGES.map((l) => (
                <span
                  key={l.code}
                  className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-emerald-400 font-medium border border-slate-700"
                >
                  {l.nativeName}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} PolicyPal. {t('common.allRightsReserved')}</p>
          <div className="flex items-center gap-1">
            <span>{t('landing.trustedByCitizens')}</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </div>
        </div>
      </div>

      {/* Tricolor Bottom Edge */}
      <div className="tiranga-bar" />
    </footer>
  );
}
