export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    fontFamily: "'Noto Sans Devanagari', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Devanagari:wght@400;500;600;700',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    fontFamily: "'Noto Sans Telugu', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Telugu:wght@400;500;600;700',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    fontFamily: "'Noto Sans Tamil', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Tamil:wght@400;500;600;700',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    fontFamily: "'Noto Sans Kannada', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Kannada:wght@400;500;600;700',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    fontFamily: "'Noto Sans Malayalam', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Malayalam:wght@400;500;600;700',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    fontFamily: "'Noto Sans Devanagari', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Devanagari:wght@400;500;600;700',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    fontFamily: "'Noto Sans Gujarati', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Gujarati:wght@400;500;600;700',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    fontFamily: "'Noto Sans Bengali', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Bengali:wght@400;500;600;700',
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    fontFamily: "'Noto Sans Gurmukhi', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Gurmukhi:wght@400;500;600;700',
  },
  {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    fontFamily: "'Noto Sans Oriya', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Oriya:wght@400;500;600;700',
  },
  {
    code: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    fontFamily: "'Noto Sans Bengali', 'Plus Jakarta Sans', sans-serif",
    dir: 'ltr',
    googleFont: 'Noto+Sans+Bengali:wght@400;500;600;700',
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    fontFamily: "'Noto Naskh Arabic', 'Plus Jakarta Sans', serif",
    dir: 'rtl',
    googleFont: 'Noto+Naskh+Arabic:wght@400;500;600;700',
  },
];

export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export const DEFAULT_LANGUAGE = 'en';

export function getLanguageConfig(code) {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) || SUPPORTED_LANGUAGES[0];
}
