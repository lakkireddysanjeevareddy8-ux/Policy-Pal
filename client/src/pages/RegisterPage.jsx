import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { SUPPORTED_LANGUAGES } from '../i18n/languages.js';
import { changeLanguage } from '../i18n/index.js';
import { ShieldCheck, UserPlus, Loader2, Globe } from 'lucide-react';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [prefLang, setPrefLang] = useState(i18n.language || 'en');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('auth.registerTitle')}`;
  }, [t]);

  const handleLangChange = (code) => {
    setPrefLang(code);
    changeLanguage(code);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg(t('auth.passwordPlaceholder'));
      return;
    }

    setLoading(true);
    try {
      const res = await register(email, password, fullName, prefLang);
      if (res.success) {
        showToast(t('auth.registerSuccess'), 'success');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const errCode = err.response?.data?.error?.code;
      let message = t('errors.generic');
      if (errCode === 'AUTH_EMAIL_EXISTS') {
        message = t('errors.emailAlreadyExists');
      } else if (errCode === 'VALIDATION_FAILED') {
        message = t('errors.validationFailed');
      } else if (err.response?.data?.error?.message) {
        message = err.response.data.error.message;
      }
      setErrorMsg(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{t('auth.registerTitle')}</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-start">
              {t('auth.fullNameLabel')}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('auth.fullNamePlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-start">
              {t('auth.emailLabel')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-start">
              {t('auth.passwordLabel')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-start">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('auth.preferredLanguageLabel')}</span>
            </label>
            <select
              value={prefLang}
              onChange={(e) => handleLangChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>{loading ? t('auth.registering') : t('auth.submitRegister')}</span>
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-emerald-600 hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
