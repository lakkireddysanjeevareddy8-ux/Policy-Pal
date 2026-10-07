import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '../i18n/languages.js';
import { changeLanguage } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

export default function LanguageSwitcher({ className = '', variant = 'dropdown' }) {
  const { i18n, t } = useTranslation();
  const { isAuthenticated, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const currentCode = i18n.language || 'en';
  const currentLang = getLanguageConfig(currentCode);

  const handleSelectLanguage = async (code) => {
    setIsOpen(false);
    setFocusedIndex(-1);
    if (code === currentCode) return;

    try {
      await changeLanguage(code);

      // Fire and forget save to user profile if logged in
      if (isAuthenticated && token) {
        api.put('/profile', { preferred_language: code }).catch((err) => {
          console.warn('Could not persist preferred_language to backend profile:', err.message);
        });
      }
    } catch (e) {
      console.error('Failed to change language:', e);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(SUPPORTED_LANGUAGES.findIndex((l) => l.code === currentCode));
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < SUPPORTED_LANGUAGES.length) {
        handleSelectLanguage(SUPPORTED_LANGUAGES[focusedIndex].code);
      }
    }
  };

  return (
    <div className={`relative inline-block text-start ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id="language-switcher-button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('nav.selectLanguage', 'Select Language')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="font-bold text-slate-800">{currentLang.nativeName}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">({currentLang.code})</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          id="language-switcher-menu"
          aria-labelledby="language-switcher-button"
          tabIndex={-1}
          className="absolute end-0 mt-1.5 w-64 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '220px' }}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{t('nav.selectLanguage', 'Select Language')}</span>
            <span className="text-emerald-600 font-bold">13 Languages</span>
          </div>

          <div className="py-1">
            {SUPPORTED_LANGUAGES.map((lang, idx) => {
              const isSelected = lang.code === currentCode;
              const isFocused = idx === focusedIndex;

              return (
                <button
                  key={lang.code}
                  role="option"
                  id={`lang-option-${lang.code}`}
                  aria-selected={isSelected}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`w-full text-start px-3 py-2 flex items-center justify-between transition text-xs ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 font-bold'
                      : isFocused
                      ? 'bg-slate-50 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-slate-900 truncate">
                      {lang.nativeName}
                    </span>
                    <span className="text-slate-500 text-[11px] truncate">
                      ({lang.name})
                    </span>
                    {lang.dir === 'rtl' && (
                      <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
                        RTL
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 ms-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
