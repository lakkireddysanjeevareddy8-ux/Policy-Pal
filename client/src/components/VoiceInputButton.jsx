import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Loader2, Check, AlertCircle, HelpCircle } from 'lucide-react';
import { useSpeechToText } from '../hooks/useSpeechToText.js';
import { getSpeechLanguage } from '../i18n/speechLanguages.js';

/**
 * Universal Voice Input Button
 * Supports browser SpeechRecognition with automatic fallback to MediaRecorder + Gemini
 */
export default function VoiceInputButton({
  language = 'en',
  onText,
  disabled = false,
  maxChars = 2000,
  className = '',
  forceFallback = false,
  showPrivacyHint = true,
  size = 'md', // 'sm' | 'md' | 'lg'
}) {
  const { t } = useTranslation();
  const [showHelp, setShowHelp] = useState(false);

  const {
    state,
    isListening,
    isProcessing,
    isSupported,
    isSecure,
    isFallbackMode,
    errorKey,
    timerSeconds,
    maxSeconds,
    startListening,
    stopListening,
    reset,
  } = useSpeechToText({
    language,
    onText,
    maxChars,
    disabled,
    forceFallback,
  });

  const langConfig = getSpeechLanguage(language);

  // Keyboard accessibility: Escape to cancel/stop
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isListening) {
        stopListening();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, stopListening]);

  // If not a secure context (HTTP on non-localhost), hide button and show note
  if (!isSecure) {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200"
        role="status"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{t('voice.insecure_context', 'Voice input requires HTTPS or localhost.')}</span>
      </div>
    );
  }

  const getStatusAnnouncement = () => {
    if (isListening) {
      return `${t('voice.listening', 'Listening')} in ${langConfig.nativeName} (${timerSeconds}s / ${maxSeconds}s). ${t('voice.press_to_stop', 'Press again to stop')}.`;
    }
    if (isProcessing) {
      return t('voice.processing', 'Converting speech to text...');
    }
    if (state === 'success') {
      return t('voice.success', 'Voice transcription successful.');
    }
    if (state === 'error' && errorKey) {
      return `${t('voice.error_prefix', 'Voice error')}: ${t(`voice.errors.${errorKey}`, 'Unable to capture speech.')}`;
    }
    return '';
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (disabled || isProcessing) return;

    if (isListening) {
      stopListening();
    } else {
      if (state === 'error') {
        reset();
      }
      startListening();
    }
  };

  // Dimensions: Ensure touch target is at least 44x44px for accessibility
  const buttonDimensions =
    size === 'sm'
      ? 'min-w-[44px] min-h-[44px] p-2'
      : size === 'lg'
      ? 'min-w-[48px] min-h-[48px] p-3'
      : 'min-w-[44px] min-h-[44px] p-2.5';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Screen Reader Announcement Live Region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {getStatusAnnouncement()}
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        aria-label={
          isListening
            ? `${t('voice.stop_listening', 'Stop listening')} (${timerSeconds}s)`
            : `${t('voice.start_listening', 'Voice input')} (${langConfig.nativeName})`
        }
        aria-pressed={isListening}
        className={`relative inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${buttonDimensions} ${
          isListening
            ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700 animate-pulse'
            : isProcessing
            ? 'bg-blue-100 text-blue-700 cursor-wait'
            : state === 'success'
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : state === 'error'
            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 hover:text-slate-900 border border-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={
          isListening
            ? t('voice.click_to_stop', 'Click to finish speaking')
            : `${t('voice.speak_in', 'Speak in')} ${langConfig.nativeName}`
        }
      >
        {isListening ? (
          <span className="flex items-center gap-1.5">
            <Square className="w-4 h-4 fill-current" />
            <span className="text-xs font-mono font-bold tracking-tight">
              {timerSeconds}s
            </span>
          </span>
        ) : isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        ) : state === 'success' ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : state === 'error' ? (
          <AlertCircle className="w-4 h-4 text-amber-700" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Error message tooltip/popup */}
      {state === 'error' && errorKey && (
        <div
          className="absolute z-30 bottom-full mb-2 start-0 end-auto w-64 p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl border border-slate-700 leading-snug animate-in fade-in zoom-in-95"
          role="alert"
        >
          <div className="font-semibold text-amber-400 mb-1 flex items-center justify-between">
            <span>{t('voice.error_title', 'Voice Input Note')}</span>
            <button
              type="button"
              onClick={reset}
              className="text-slate-400 hover:text-white text-xs underline p-0.5"
            >
              {t('common.dismiss', 'Dismiss')}
            </button>
          </div>
          <p>{t(`voice.errors.${errorKey}`, 'Unable to capture speech.')}</p>
          {errorKey === 'permission_denied' && (
            <p className="mt-1 text-[11px] text-slate-300">
              {t(
                'voice.how_to_allow_mic',
                'Click the lock or tune icon beside the URL in your browser bar and allow Microphone.'
              )}
            </p>
          )}
          {isFallbackMode && (
            <p className="mt-1 text-[10px] text-blue-300">
              {t('voice.fallback_active', 'Using server-assisted audio fallback.')}
            </p>
          )}
        </div>
      )}

      {/* Privacy Hint button */}
      {showPrivacyHint && !isListening && (
        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          className="ms-1 p-1 text-slate-400 hover:text-slate-600 rounded-full focus-visible:ring-1 focus-visible:ring-blue-500"
          aria-label={t('voice.privacy_info', 'Voice privacy information')}
          title={t('voice.privacy_notice', 'Voice is converted to text by your browser speech service, or by our server if your browser cannot do it. Audio is not saved.')}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {showHelp && (
        <div
          className="absolute z-30 bottom-full mb-2 start-0 w-72 p-2.5 bg-slate-900 text-slate-200 text-xs rounded-lg shadow-xl border border-slate-700 leading-relaxed"
          onBlur={() => setShowHelp(false)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">
              {t('voice.privacy_title', 'Voice Privacy')}
            </span>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <p>
            {t(
              'voice.privacy_notice',
              "Voice is converted to text by your browser's speech service, or by our server if your browser cannot do it. Audio is not saved."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
