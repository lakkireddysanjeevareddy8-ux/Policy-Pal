import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  X,
  Send,
  Plus,
  History,
  Volume2,
  VolumeX,
  ExternalLink,
  Trash2,
  Search,
  Bot,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api/client.js';
import VoiceInputButton from '../VoiceInputButton.jsx';
import SafeText from './SafeText.jsx';
import { speakMessage, cancelSpeech, isSpeechSupported } from './ChatSpeech.js';
import { getSpeechLanguage } from '../../i18n/speechLanguages.js';

export default function PolicyPalAssistant() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [noVoiceNotice, setNoVoiceNotice] = useState('');

  // Audio auto-reply preference
  const [autoSpeak, setAutoSpeak] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('policypal_voice_reply') === 'true';
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const currentLang = i18n.language || 'en';
  const isRtl = i18n.dir ? i18n.dir() === 'rtl' : false;

  // Toggle speaker auto-read
  const handleToggleSpeaker = () => {
    setAutoSpeak((prev) => {
      const nextVal = !prev;
      localStorage.setItem('policypal_voice_reply', String(nextVal));
      if (!nextVal) {
        cancelSpeech();
        setSpeakingMessageId(null);
      }
      return nextVal;
    });
  };

  // Cancel speech whenever route changes or panel closes
  useEffect(() => {
    cancelSpeech();
    setSpeakingMessageId(null);
  }, [location.pathname, isOpen]);

  // Keyboard accessibility: Escape closes panel
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        cancelSpeech();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !showHistory) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, showHistory]);

  // Fetch conversation history
  const fetchConversations = useCallback(
    async (searchTerm = '') => {
      if (!isAuthenticated) return;
      try {
        setLoadingHistory(true);
        const url = searchTerm ? `/chat/conversations?q=${encodeURIComponent(searchTerm)}` : '/chat/conversations';
        const res = await api.get(url);
        if (res.data?.success) {
          setConversations(res.data.data.conversations || []);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoadingHistory(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    if (showHistory) {
      fetchConversations(historySearch);
    }
  }, [showHistory, historySearch, fetchConversations]);

  // Load a selected conversation
  const handleSelectConversation = async (convId) => {
    try {
      cancelSpeech();
      setSpeakingMessageId(null);
      const res = await api.get(`/chat/conversations/${convId}`);
      if (res.data?.success) {
        setActiveConversationId(convId);
        setMessages(res.data.data.messages || []);
        setShowHistory(false);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Start fresh chat
  const handleNewChat = () => {
    cancelSpeech();
    setSpeakingMessageId(null);
    setActiveConversationId(null);
    setMessages([]);
    setShowHistory(false);
    setInputText('');
    setNoVoiceNotice('');
  };

  // Speak a message aloud
  const handleSpeak = (msgId, text, langCode) => {
    if (speakingMessageId === msgId) {
      cancelSpeech();
      setSpeakingMessageId(null);
      return;
    }

    setNoVoiceNotice('');
    speakMessage(text, langCode, {
      onStart: () => setSpeakingMessageId(msgId),
      onEnd: () => setSpeakingMessageId(null),
      onNoVoice: (code) => {
        const langInfo = getSpeechLanguage(code);
        setNoVoiceNotice(
          t(
            'chat.no_voice_available',
            `Voice is not available for ${langInfo.name} on your device; text only.`
          )
        );
        setTimeout(() => setNoVoiceNotice(''), 5000);
      },
    });
  };

  // Send a message
  const handleSendMessage = async (textToSend, inputMode = 'text') => {
    const message = (textToSend || inputText).trim();
    if (!message || isSending) return;

    cancelSpeech();
    setSpeakingMessageId(null);
    setInputText('');
    setNoVoiceNotice('');

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      detected_language: currentLang,
      input_mode: inputMode,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const res = await api.post('/chat', {
        conversation_id: activeConversationId,
        message,
        ui_language: currentLang,
        input_mode: inputMode,
      });

      if (res.data?.success) {
        const { conversation_id, reply, language, followups, actions } = res.data.data;
        if (!activeConversationId) {
          setActiveConversationId(conversation_id);
        }

        const assistantMsg = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: reply,
          detected_language: language,
          actions: actions || [],
          followups: followups || [],
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Auto speak if enabled
        if (autoSpeak) {
          handleSpeak(assistantMsg.id, reply, language);
        }
      }
    } catch (err) {
      console.error('Chat request failed:', err);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t(
          'chat.unavailable_error',
          'PolicyPal Assistant is temporarily unavailable. Please try again in a few moments.'
        ),
        detected_language: currentLang,
        isError: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle voice text captured by VoiceInputButton
  const handleVoiceInput = (text, { isFinal }) => {
    if (isFinal) {
      setInputText((prev) => {
        const cleaned = text.trim();
        if (!cleaned) return prev;
        const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
        return `${prev}${needsSpace ? ' ' : ''}${cleaned}`.slice(0, 1000);
      });
    }
  };

  // Execute action button safely via React Router
  const handleActionClick = (action) => {
    setIsOpen(false);
    cancelSpeech();

    switch (action.type) {
      case 'open_scheme':
        if (action.slug) {
          navigate(`/schemes/${action.slug}`);
        } else {
          navigate('/schemes');
        }
        break;
      case 'open_documents':
        navigate('/documents');
        break;
      case 'start_assessment':
        navigate('/assessments/new');
        break;
      case 'open_applications':
        navigate('/applications');
        break;
      default:
        navigate('/dashboard');
    }
  };

  // Only render for authenticated users
  if (!isAuthenticated) {
    return null;
  }

  // Starter questions per language
  const starterChips = [
    t('chat.starter_eligibility', 'What schemes am I eligible for?'),
    t('chat.starter_documents', 'Which documents am I missing?'),
    t('chat.starter_pmkisan', 'How do I apply for PM-KISAN?'),
  ];

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={t('chat.open_assistant', 'Open PolicyPal Assistant')}
          className="fixed bottom-6 end-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-full shadow-2xl hover:shadow-emerald-600/30 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/50 cursor-pointer min-h-[44px]"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-emerald-700 animate-pulse" />
          </div>
          <span className="text-sm font-bold tracking-tight hidden sm:inline">
            {t('chat.assistant_title', 'PolicyPal Assistant')}
          </span>
        </button>
      )}

      {/* Assistant Modal / Bottom Sheet */}
      {isOpen && (
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('chat.assistant_title', 'PolicyPal Assistant')}
          className={`fixed z-50 bg-white border border-slate-200 shadow-2xl flex flex-col transition-all duration-300 ${
            // Mobile: Full bottom sheet (at 375px)
            'inset-x-0 bottom-0 h-[88vh] max-h-[88vh] rounded-t-3xl ' +
            // Desktop: Floating panel in bottom-end corner
            'sm:inset-x-auto sm:bottom-6 sm:end-6 sm:w-[420px] sm:h-[620px] sm:max-h-[620px] sm:rounded-3xl'
          }`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80 rounded-t-3xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {t('chat.assistant_title', 'PolicyPal Assistant')}
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {t('chat.assistant_subtitle', 'Multilingual Welfare Guide')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-500">
              {/* Audio Read-Aloud Toggle */}
              {isSpeechSupported() && (
                <button
                  type="button"
                  onClick={handleToggleSpeaker}
                  className={`p-2 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center ${
                    autoSpeak
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                  }`}
                  title={
                    autoSpeak
                      ? t('chat.mute_voice', 'Turn off voice replies')
                      : t('chat.enable_voice', 'Read replies aloud')
                  }
                  aria-label={t('chat.voice_replies', 'Voice replies')}
                >
                  {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {/* History Button */}
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className={`p-2 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  showHistory
                    ? 'text-emerald-700 bg-emerald-100'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                }`}
                title={t('chat.conversation_history', 'Conversation history')}
                aria-label={t('chat.conversation_history', 'Conversation history')}
              >
                <History className="w-4 h-4" />
              </button>

              {/* New Chat Button */}
              <button
                type="button"
                onClick={handleNewChat}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                title={t('chat.new_chat', 'Start new chat')}
                aria-label={t('chat.new_chat', 'Start new chat')}
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                title={t('common.close', 'Close')}
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* No voice available device warning banner */}
          {noVoiceNotice && (
            <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5 animate-in fade-in">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>{noVoiceNotice}</span>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {showHistory ? (
              // Conversation History List View
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder={t('chat.search_history', 'Search conversations...')}
                    className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  {loadingHistory ? (
                    <p className="text-center py-6 text-xs text-slate-400">
                      {t('common.loading', 'Loading...')}
                    </p>
                  ) : conversations.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400">
                      {t('chat.no_conversations', 'No conversations yet.')}
                    </p>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`group p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                          conv.id === activeConversationId
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {conv.title}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(conv.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
                          title={t('common.delete', 'Delete')}
                          aria-label={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Chat Messages Stream
              <>
                {messages.length === 0 ? (
                  // Empty State with Starter Chips
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {t('chat.welcome_title', 'How can I assist you today?')}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        {t(
                          'chat.welcome_desc',
                          'Ask me about government schemes, document readiness, or application steps.'
                        )}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 text-start max-w-xs mx-auto">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {t('chat.suggested_questions', 'Suggested inquiries')}:
                      </p>
                      {starterChips.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(chip, 'text')}
                          className="w-full text-start p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-xs font-medium text-slate-700 hover:text-emerald-900 transition flex items-center justify-between group"
                        >
                          <span>{chip}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Messages List
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`flex gap-2 max-w-[88%] ${
                          msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 mt-1 ${
                            msg.role === 'user'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <UserIcon className="w-3.5 h-3.5" />
                          ) : (
                            <Bot className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {/* Bubble */}
                        <div
                          className={`p-3 rounded-2xl text-xs space-y-2 ${
                            msg.role === 'user'
                              ? 'bg-emerald-600 text-white rounded-ee-none'
                              : msg.isError
                              ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-es-none'
                              : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-es-none'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          ) : (
                            <SafeText text={msg.content} />
                          )}

                          {/* Action Buttons */}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="pt-2 space-y-1.5 border-t border-slate-200/60">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t('chat.actions_label', 'Recommended Action')}:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.actions.map((act, actIdx) => (
                                  <button
                                    key={actIdx}
                                    type="button"
                                    onClick={() => handleActionClick(act)}
                                    className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-50 hover:shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span>{act.label}</span>
                                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Follow-up Chips */}
                          {msg.followups && msg.followups.length > 0 && (
                            <div className="pt-2 space-y-1.5 border-t border-slate-200/60">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t('chat.followups_label', 'Suggested Questions')}:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.followups.map((fup, fIdx) => (
                                  <button
                                    key={fIdx}
                                    type="button"
                                    onClick={() => handleSendMessage(fup, 'text')}
                                    className="px-2.5 py-1 rounded-lg bg-white/80 border border-slate-300 text-slate-700 text-[10px] font-medium hover:border-emerald-400 hover:text-emerald-800 transition"
                                  >
                                    {fup}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Info: Timestamp, Language Badge, Speak Button */}
                      <div
                        className={`flex items-center gap-2 mt-1 px-8 text-[10px] text-slate-400 ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {msg.role === 'assistant' && (
                          <>
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[9px] uppercase">
                              {getSpeechLanguage(msg.detected_language).nativeName}
                            </span>

                            {isSpeechSupported() && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSpeak(msg.id, msg.content, msg.detected_language)
                                }
                                className={`p-0.5 hover:text-slate-700 transition ${
                                  speakingMessageId === msg.id
                                    ? 'text-emerald-600 font-bold'
                                    : 'text-slate-400'
                                }`}
                                title={t('chat.read_aloud', 'Read aloud')}
                                aria-label={t('chat.read_aloud', 'Read aloud')}
                              >
                                <Volume2 className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* Typing Indicator */}
                {isSending && (
                  <div
                    className="flex items-center gap-2"
                    role="status"
                    aria-live="polite"
                    aria-label={t('chat.assistant_thinking', 'PolicyPal Assistant is responding...')}
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 bg-slate-100 rounded-2xl rounded-es-none border border-slate-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Footer Disclaimer & Input Box */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2 rounded-b-3xl">
            {/* Input Form */}
            {!showHistory && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value.slice(0, 1000))}
                    placeholder={t('chat.input_placeholder', 'Ask a question or speak...')}
                    disabled={isSending}
                    className="w-full py-2.5 ps-3 pe-12 bg-white rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 end-1">
                    <VoiceInputButton
                      language={currentLang}
                      onText={handleVoiceInput}
                      disabled={isSending}
                      maxChars={1000}
                      size="sm"
                      showPrivacyHint={false}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
                  aria-label={t('common.send', 'Send message')}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-tight">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              <span>
                {t(
                  'chat.disclaimer',
                  'AI answers can be wrong. Verify on the official portal. Do not share Aadhaar, OTP or bank details.'
                )}
              </span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
