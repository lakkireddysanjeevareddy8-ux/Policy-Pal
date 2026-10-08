import { getSpeechCode } from '../../i18n/speechLanguages.js';

/**
 * Client-Side Text-To-Speech using native window.speechSynthesis
 * Zero Google/Gemini calls from browser. No keys exposed.
 */

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function cancelSpeech() {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
}

/**
 * Speaks text using the device's native speech synthesis voice.
 *
 * @param {string} text - Clean text to speak
 * @param {string} appLangCode - Application language code (e.g. 'te', 'hi', 'en')
 * @param {Object} options
 * @param {Function} [options.onStart] - Callback when speech begins
 * @param {Function} [options.onEnd] - Callback when speech ends
 * @param {Function} [options.onNoVoice] - Callback when device lacks voice for this language
 */
export function speakMessage(text, appLangCode = 'en', { onStart, onEnd, onNoVoice } = {}) {
  if (!isSpeechSupported() || !text) {
    if (onNoVoice) onNoVoice(appLangCode);
    return;
  }

  // Cancel any previous speech
  cancelSpeech();

  const speechCode = getSpeechCode(appLangCode);
  const voices = window.speechSynthesis.getVoices();

  // Find a voice matching the specific speech tag or language prefix
  const targetPrefix = speechCode.toLowerCase().split('-')[0];
  const matchedVoice = voices.find(
    (v) =>
      v.lang.toLowerCase() === speechCode.toLowerCase() ||
      v.lang.toLowerCase().replace('_', '-').startsWith(targetPrefix)
  );

  // If the device has no synthesizer voice for this Indic language
  if (!matchedVoice && targetPrefix !== 'en') {
    if (onNoVoice) onNoVoice(appLangCode);
    return;
  }

  try {
    // Strip simple markdown bold asterisks before speaking
    const cleanText = text.replace(/\*\*/g, '').replace(/\[REDACTED\]/g, 'redacted');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = speechCode;
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis playback error:', err);
    if (onNoVoice) onNoVoice(appLangCode);
    if (onEnd) onEnd();
  }
}
