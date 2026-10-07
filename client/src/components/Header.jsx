import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  ShieldCheck,
  LayoutDashboard,
  Sparkles,
  Layers,
  FileCheck2,
  Compass,
  User,
  LogOut,
  LogIn,
  Menu,
  X,
  Globe,
} from 'lucide-react';

export default function Header() {
  const { user, isAuthenticated, logout, language, setLanguage, t } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);

  React.useEffect(() => {
    const handleWakingUp = (e) => {
      setWakingUp(Boolean(e.detail));
    };
    window.addEventListener('policypal:waking-up', handleWakingUp);
    return () => window.removeEventListener('policypal:waking-up', handleWakingUp);
  }, []);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { name: t('dashboard'), path: '/dashboard', authRequired: true, icon: LayoutDashboard },
    { name: t('newCheck'), path: '/assessments/new', authRequired: true, icon: Sparkles },
    { name: t('myApplications'), path: '/applications', authRequired: true, icon: Layers },
    { name: t('docTracker'), path: '/documents', authRequired: true, icon: FileCheck2 },
    { name: t('browseSchemes'), path: '/schemes', authRequired: false, icon: Compass },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Indian Tricolor Stripe */}
      <div className="tiranga-bar" />

      {/* Waking Up The Server Banner */}
      {wakingUp && (
        <div className="bg-amber-500 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 animate-pulse shadow-inner">
          <Sparkles className="w-4 h-4 animate-spin text-amber-200" />
          <span>Waking up the server (Render free-tier cold start)... Please hold on for a moment!</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                Policy<span className="text-emerald-600">Pal</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Gov AI
                </span>
              </span>
              <p className="text-[11px] text-slate-500 hidden sm:block leading-none">
                National Welfare Discovery
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks
              .filter((link) => !link.authRequired || isAuthenticated)
              .map((link) => {
                const Icon = link.icon;
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {link.name}
                  </Link>
                );
              })}
          </nav>

          {/* Language Switcher & User Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded font-medium transition ${
                  language === 'en'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('te')}
                className={`px-2 py-1 rounded font-medium transition ${
                  language === 'te'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1 rounded font-medium transition ${
                  language === 'hi'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी
              </button>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition text-sm text-slate-700"
                  title={user?.full_name || 'Profile'}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs border border-emerald-300">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="font-medium max-w-[120px] truncate text-slate-800 hidden lg:inline">
                    {user?.full_name?.split(' ')[0]}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
                >
                  {t('login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-600/30 transition"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-fade-in shadow-xl">
          {/* Mobile Language Switcher */}
          <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Globe className="w-4 h-4" /> Language
            </span>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded ${language === 'en' ? 'bg-white font-bold shadow' : 'text-slate-600'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('te')}
                className={`px-2.5 py-1 rounded ${language === 'te' ? 'bg-white font-bold shadow' : 'text-slate-600'}`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded ${language === 'hi' ? 'bg-white font-bold shadow' : 'text-slate-600'}`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {navLinks
              .filter((link) => !link.authRequired || isAuthenticated)
              .map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Icon className="w-5 h-5 text-emerald-600" />
                    {link.name}
                  </Link>
                );
              })}
          </div>

          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
                >
                  <User className="w-5 h-5 text-slate-400" />
                  {user?.full_name} ({t('profile')})
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-5 h-5 text-rose-500" />
                  {t('logout')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 px-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700"
                >
                  {t('login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 px-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
