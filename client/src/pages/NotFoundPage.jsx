import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('nav.appName')} - 404 ${t('common.pageNotFound')}`;
  }, [t]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-md space-y-5">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900">404</h1>
          <h2 className="text-lg font-bold text-slate-800">{t('common.pageNotFound')}</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t('common.pageNotFoundDesc')}
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('common.backToHome')}</span>
        </Link>
      </div>
    </div>
  );
}
