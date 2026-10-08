import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ShieldCheck, LogIn, Sparkles, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, loginWithDemo, isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    document.title = `${t('nav.appName')} - ${t('auth.loginTitle')}`;
  }, [t]);

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        showToast(t('auth.loginSuccess'), 'success');
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      const errCode = err.response?.data?.error?.code;
      let message = t('errors.invalidCredentials');
      if (errCode === 'AUTH_INVALID_CREDENTIALS') {
        message = t('errors.invalidCredentials');
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

  const handleDemoLogin = async () => {
    setErrorMsg('');
    setDemoLoading(true);
    try {
      const res = await loginWithDemo();
      if (res.success) {
        showToast(t('auth.loginSuccess'), 'success');
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      const message = t('errors.serverError');
      setErrorMsg(message);
      showToast(message, 'error');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{t('auth.loginTitle')}</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {t('auth.loginSubtitle')}
          </p>
        </div>

        {/* Demo Account Callout */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2.5">
          <p className="text-xs text-amber-900 font-medium">
            {t('landing.demoAccountPrompt')}
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {demoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{t('auth.demoLoginButton')}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Traditional Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider text-start">
                {t('auth.passwordLabel')}
              </label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4 rtl:rotate-180" />
            )}
            <span>{loading ? t('auth.loggingIn') : t('auth.submitLogin')}</span>
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-emerald-600 hover:underline">
            {t('nav.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
