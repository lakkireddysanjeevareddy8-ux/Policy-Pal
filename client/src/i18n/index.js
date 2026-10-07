import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguageConfig } from './languages.js';
import enTranslations from './locales/en.json';

const STORAGE_KEY = 'policypal_lang';

export function getInitialLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  // 1. Synchronously read from localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
    return stored;
  }

  // 2. If logged in and nothing stored in policypal_lang, check stored user object
  try {
    const userStr = localStorage.getItem('policypal_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.preferred_language && SUPPORTED_LANGUAGES.some((l) => l.code === user.preferred_language)) {
        localStorage.setItem(STORAGE_KEY, user.preferred_language);
        return user.preferred_language;
      }
    }
  } catch {}

  // 3. Fallback to English
  return DEFAULT_LANGUAGE;
}

const localeLoaders = {
  en: () => Promise.resolve({ default: enTranslations }),
  hi: () => import('./locales/hi.json'),
  te: () => import('./locales/te.json'),
  ta: () => import('./locales/ta.json'),
  kn: () => import('./locales/kn.json'),
  ml: () => import('./locales/ml.json'),
  mr: () => import('./locales/mr.json'),
  gu: () => import('./locales/gu.json'),
  bn: () => import('./locales/bn.json'),
  pa: () => import('./locales/pa.json'),
  or: () => import('./locales/or.json'),
  as: () => import('./locales/as.json'),
  ur: () => import('./locales/ur.json'),
};

const loadedLocales = new Set(['en']);

export async function loadLocaleData(langCode) {
  if (loadedLocales.has(langCode)) return;
  const loader = localeLoaders[langCode];
  if (!loader) return;

  try {
    const module = await loader();
    const translations = module.default || module;
    i18n.addResourceBundle(langCode, 'translation', translations, true, true);
    loadedLocales.add(langCode);
  } catch (err) {
    console.error(`Failed to load translations for ${langCode}:`, err);
  }
}

export function applyDocumentAttributes(code) {
  if (typeof document === 'undefined') return;
  const config = getLanguageConfig(code);
  document.documentElement.lang = code;
  document.documentElement.dir = config.dir || 'ltr';

  // Apply typography classes to root
  document.documentElement.classList.remove(
    'lang-en', 'lang-hi', 'lang-te', 'lang-ta', 'lang-kn', 'lang-ml',
    'lang-mr', 'lang-gu', 'lang-bn', 'lang-pa', 'lang-or', 'lang-as', 'lang-ur'
  );
  document.documentElement.classList.add(`lang-${code}`);

  // Dynamic font loading
  if (config.googleFont && !document.getElementById(`font-${code}`)) {
    const link = document.createElement('link');
    link.id = `font-${code}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${config.googleFont}&display=swap`;
    document.head.appendChild(link);
  }

  // Update CSS font variable on root
  document.documentElement.style.setProperty('--font-current', config.fontFamily);
}

export async function changeLanguage(code) {
  if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) return;

  // 1. Lazy load locale data if needed
  await loadLocaleData(code);

  // 2. Change i18next language
  await i18n.changeLanguage(code);

  // 3. Persist immediately in localStorage
  localStorage.setItem(STORAGE_KEY, code);

  // 4. Update document lang and dir (RTL support for Urdu)
  applyDocumentAttributes(code);

  // 5. Fire custom event for any non-React listeners
  window.dispatchEvent(new CustomEvent('policypal:language-changed', { detail: code }));
}

export async function initI18n() {
  const initialLang = getInitialLanguage();

  // Load the initial language if non-English before first render
  let initialResources = {
    en: { translation: enTranslations },
  };

  if (initialLang !== 'en') {
    const loader = localeLoaders[initialLang];
    if (loader) {
      try {
        const mod = await loader();
        initialResources[initialLang] = { translation: mod.default || mod };
        loadedLocales.add(initialLang);
      } catch (e) {
        console.warn(`Could not load initial locale ${initialLang}, falling back to English:`, e);
      }
    }
  }

  await i18n.use(initReactI18next).init({
    resources: initialResources,
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

  applyDocumentAttributes(initialLang);
  return i18n;
}

export default i18n;
