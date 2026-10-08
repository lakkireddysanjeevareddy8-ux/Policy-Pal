/**
 * Speech Recognition and Speech Synthesis Language Configuration
 * Maps the 13 supported application languages to their Indian BCP-47 speech tags.
 */

export const SPEECH_LANGUAGES = {
  en: { code: 'en', speechCode: 'en-IN', name: 'English', nativeName: 'English' },
  hi: { code: 'hi', speechCode: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  te: { code: 'te', speechCode: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
  ta: { code: 'ta', speechCode: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
  kn: { code: 'kn', speechCode: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  ml: { code: 'ml', speechCode: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം' },
  mr: { code: 'mr', speechCode: 'mr-IN', name: 'Marathi', nativeName: 'मराठी' },
  gu: { code: 'gu', speechCode: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  bn: { code: 'bn', speechCode: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা' },
  pa: { code: 'pa', speechCode: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  or: { code: 'or', speechCode: 'or-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  as: { code: 'as', speechCode: 'as-IN', name: 'Assamese', nativeName: 'অসমীয়া' },
  ur: { code: 'ur', speechCode: 'ur-IN', name: 'Urdu', nativeName: 'اردو' },
};

export const SUPPORTED_SPEECH_CODES = Object.values(SPEECH_LANGUAGES).map((l) => l.speechCode);
export const SUPPORTED_APP_CODES = Object.keys(SPEECH_LANGUAGES);

export function getSpeechLanguage(appCode) {
  const normalized = (appCode || 'en').toLowerCase().split('-')[0];
  return SPEECH_LANGUAGES[normalized] || SPEECH_LANGUAGES.en;
}

export function getSpeechCode(appCode) {
  return getSpeechLanguage(appCode).speechCode;
}

export function getAppCodeFromSpeechCode(speechCode) {
  if (!speechCode) return 'en';
  const entry = Object.values(SPEECH_LANGUAGES).find(
    (l) => l.speechCode.toLowerCase() === speechCode.toLowerCase() || l.code === speechCode.toLowerCase()
  );
  return entry ? entry.code : 'en';
}
