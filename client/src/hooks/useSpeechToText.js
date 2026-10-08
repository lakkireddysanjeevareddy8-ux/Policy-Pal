import { useState, useRef, useEffect, useCallback } from 'react';
import { getSpeechCode } from '../i18n/speechLanguages.js';
import api from '../api/client.js';

/**
 * Robust Speech-to-Text React Hook
 *
 * Primary Path: Browser SpeechRecognition API (continuous + interim)
 * Fallback Path: MediaRecorder + backend POST /api/voice/transcribe via Gemini
 */
export function useSpeechToText({
  language = 'en',
  onText,
  maxChars = 2000,
  disabled = false,
  forceFallback = false,
} = {}) {
  const [state, setState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'success' | 'error'
  const [errorKey, setErrorKey] = useState(null);
  const [isFallbackMode, setIsFallbackMode] = useState(forceFallback);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const networkErrorCountRef = useRef(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Check if secure context (mic requires HTTPS or localhost)
  const isSecure = typeof window !== 'undefined' ? (window.isSecureContext ?? true) : true;

  // Check Web Speech API availability
  const hasSpeechRecognition =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition) &&
    !forceFallback;

  // Check MediaRecorder availability
  const hasMediaRecorder =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

  const isSupported = isSecure && (hasSpeechRecognition || hasMediaRecorder);

  // Clear timers and streams safely
  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      streamRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  // Stop listening gracefully
  const stopListening = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
  }, []);

  // Reset state to idle
  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setErrorKey(null);
    setTimerSeconds(0);
    setInterimTranscript('');
  }, [cleanup]);

  // Start Fallback recording using MediaRecorder
  const startFallbackRecording = useCallback(async () => {
    cleanup();
    setErrorKey(null);
    setInterimTranscript('');
    setTimerSeconds(0);
    setIsFallbackMode(true);

    if (!hasMediaRecorder) {
      setState('error');
      setErrorKey('no_microphone');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported audio MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        '',
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (!mime || MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Release mic track immediately
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const mime = recorder.mimeType || selectedMime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];

        if (blob.size === 0) {
          setState('error');
          setErrorKey('no_speech');
          return;
        }

        if (blob.size > 1.5 * 1024 * 1024) {
          setState('error');
          setErrorKey('too_long');
          return;
        }

        setState('processing');

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.' + (mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm'));
          formData.append('hint_language', language);

          const response = await api.post('/voice/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const transcript = response.data?.transcript?.trim();
          if (transcript) {
            if (onTextRef.current) {
              onTextRef.current(transcript, { isFinal: true });
            }
            setState('success');
            setTimeout(() => {
              setState((current) => (current === 'success' ? 'idle' : current));
            }, 2500);
          } else {
            setState('error');
            setErrorKey('no_speech');
          }
        } catch (err) {
          console.error('Fallback transcription failed:', err);
          setState('error');
          setErrorKey('service_unavailable');
        }
      };

      recorder.start(250);
      setState('listening');

      // Max 30 seconds timer for fallback audio
      let elapsed = 0;
      timerIntervalRef.current = setInterval(() => {
        elapsed += 1;
        setTimerSeconds(elapsed);
        if (elapsed >= 30) {
          stopListening();
        }
      }, 1000);
    } catch (err) {
      console.warn('Microphone access failed for fallback:', err);
      setState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorKey('permission_denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorKey('no_microphone');
      } else {
        setErrorKey('service_unavailable');
      }
    }
  }, [cleanup, hasMediaRecorder, language, stopListening]);

  // Start listening (dispatches to Web Speech or Fallback)
  const startListening = useCallback(async () => {
    if (disabled || !isSecure) return;

    // Use Fallback if forceFallback or browser lacks SpeechRecognition
    if (!hasSpeechRecognition || isFallbackMode) {
      return startFallbackRecording();
    }

    cleanup();
    setErrorKey(null);
    setInterimTranscript('');
    setTimerSeconds(0);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getSpeechCode(language);
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState('listening');
        networkErrorCountRef.current = 0;

        // Auto-stop after 60 seconds
        let elapsed = 0;
        timerIntervalRef.current = setInterval(() => {
          elapsed += 1;
          setTimerSeconds(elapsed);
          if (elapsed >= 60) {
            stopListening();
          }
        }, 1000);
      };

      recognition.onresult = (event) => {
        let interimStr = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptChunk = result[0].transcript;
          if (result.isFinal) {
            if (onTextRef.current) {
              onTextRef.current(transcriptChunk, { isFinal: true });
            }
          } else {
            interimStr += transcriptChunk;
          }
        }
        setInterimTranscript(interimStr);
        if (interimStr && onTextRef.current) {
          onTextRef.current(interimStr, { isFinal: false });
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        if (event.error === 'not-allowed') {
          setState('error');
          setErrorKey('permission_denied');
        } else if (event.error === 'no-speech') {
          setState('error');
          setErrorKey('no_speech');
        } else if (
          event.error === 'language-not-supported' ||
          event.error === 'service-not-allowed'
        ) {
          // Switch automatically to fallback
          setIsFallbackMode(true);
          startFallbackRecording();
        } else if (event.error === 'network') {
          networkErrorCountRef.current += 1;
          if (networkErrorCountRef.current >= 2) {
            // Repeated network errors: fall back to MediaRecorder
            setIsFallbackMode(true);
            startFallbackRecording();
          } else {
            setState('error');
            setErrorKey('network_error');
          }
        } else {
          setState('error');
          setErrorKey('service_unavailable');
        }
      };

      recognition.onend = () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setInterimTranscript('');
        setState((current) => (current === 'listening' ? 'idle' : current));
      };

      recognition.start();
    } catch (err) {
      console.warn('Could not start SpeechRecognition, falling back:', err);
      setIsFallbackMode(true);
      startFallbackRecording();
    }
  }, [
    disabled,
    isSecure,
    hasSpeechRecognition,
    isFallbackMode,
    startFallbackRecording,
    cleanup,
    language,
    stopListening,
  ]);

  // Auto-stop when language changes while listening
  useEffect(() => {
    if (state === 'listening') {
      stopListening();
    }
  }, [language, state, stopListening]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state, // 'idle' | 'listening' | 'processing' | 'success' | 'error'
    isListening: state === 'listening',
    isProcessing: state === 'processing',
    isSupported,
    isSecure,
    isFallbackMode,
    interimTranscript,
    errorKey,
    timerSeconds,
    maxSeconds: isFallbackMode ? 30 : 60,
    startListening,
    stopListening,
    reset,
  };
}

export default useSpeechToText;
