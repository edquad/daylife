import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mic, Loader2, Sparkles, X, Keyboard, Check, Square, Pencil } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { toast } from './Toaster';
import { cn } from '../lib/utils';
import { AI_COACH_NAME } from '../lib/brand';
import {
  describeVoiceAction,
  getVoiceHints,
  getVoiceLang,
  setVoiceLang,
  type VoiceAction,
  type VoiceLang,
} from '../lib/voiceCommands';
import { parseVoiceTranscriptSmart, voiceAiSupported } from '../lib/voiceBedrock';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../lib/executeVoiceCommands';
import { addMemory } from '../lib/lifeAutopilot';
import {
  collectTranscript,
  getSpeechRecognitionCtor,
  isVoiceMicAvailable,
  requestMicrophoneAccess,
  speechErrorMessage,
} from '../lib/speechRecognition';

type VoiceState = 'idle' | 'listening' | 'confirm' | 'processing';

interface VoiceAssistantSheetProps {
  open: boolean;
  onClose: () => void;
}

export function VoiceAssistantSheet({ open, onClose }: VoiceAssistantSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>('idle');
  const [lang, setLang] = useState<VoiceLang>(() => getVoiceLang());
  const [transcript, setTranscript] = useState('');
  const [editableText, setEditableText] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [addedItems, setAddedItems] = useState<string[]>([]);
  const [micAvailable] = useState(isVoiceMicAvailable());
  const [aiEnabled] = useState(voiceAiSupported());
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const confirmInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const stateRef = useRef<VoiceState>('idle');
  const recordStartedAtRef = useRef(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hints = getVoiceHints(lang);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state !== 'listening') {
      setRecordSeconds(0);
      return;
    }
    const tick = setInterval(() => {
      if (recordStartedAtRef.current > 0) {
        setRecordSeconds(Math.floor((Date.now() - recordStartedAtRef.current) / 1000));
      }
    }, 200);
    return () => clearInterval(tick);
  }, [state]);

  useEffect(() => {
    if (!open) {
      recordStartedAtRef.current = 0;
      recognitionRef.current?.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setState('idle');
      setTranscript('');
      setEditableText('');
      setStatusLine('');
      setAddedItems([]);
    }
  }, [open]);

  useEffect(() => {
    if (state === 'confirm' && confirmInputRef.current) {
      confirmInputRef.current.focus();
      confirmInputRef.current.setSelectionRange(
        confirmInputRef.current.value.length,
        confirmInputRef.current.value.length,
      );
    }
  }, [state]);

  const changeLang = (next: VoiceLang) => {
    setLang(next);
    setVoiceLang(next);
  };

  const addActions = useCallback(
    async (actions: VoiceAction[], _spokenText: string) => {
      if (!user?.id || actions.length === 0) {
        setStatusLine(lang === 'hi-IN' ? 'समझ नहीं आया — edit करें या फिर बोलें' : 'Could not understand — edit or try again');
        setState('idle');
        return;
      }
      setState('processing');
      setStatusLine(lang === 'hi-IN' ? 'जोड़ रहे हैं…' : 'Adding…');
      const result = await executeVoiceActions(actions, user.id);
      voiceQueryKeysToInvalidate().forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      const descriptions = actions.map((a) => describeVoiceAction(a));
      setAddedItems((prev) => [...descriptions, ...prev]);

      if (result.ok.length > 0) {
        toast.success(
          lang === 'hi-IN'
            ? `${result.ok.length} चीज़ add हो गई`
            : `Added ${result.ok.length} item${result.ok.length > 1 ? 's' : ''}`,
        );
      }
      if (result.failed.length > 0) {
        toast.error('Some items could not be added');
      }

      setTranscript('');
      setEditableText('');
      setState('idle');
      setStatusLine(
        lang === 'hi-IN'
          ? 'और बोलें या mic tap करें'
          : 'Done! Speak more or tap mic again',
      );
    },
    [user?.id, queryClient, lang],
  );

  const parseAndAdd = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTranscript(trimmed);
      setState('processing');
      setStatusLine(lang === 'hi-IN' ? 'AI समझ रहा है…' : 'AI understanding…');
      addMemory({ type: 'voice_input', content: trimmed });
      try {
        const { actions } = await parseVoiceTranscriptSmart(trimmed, lang);
        if (actions.length === 0) {
          setStatusLine(
            lang === 'hi-IN'
              ? 'समझ नहीं आया — edit करके try करें'
              : 'Could not parse — try editing and resend',
          );
          setState('confirm');
          setEditableText(trimmed);
          return;
        }
        // Categorize memories from parsed actions
        for (const a of actions) {
          if (a.type === 'note' && /idea|plan|concept|dream|goal/i.test(trimmed)) addMemory({ type: 'idea', content: (a as any).title || (a as any).content || trimmed });
          else if (/promise|will do|pakka|zaroor/i.test(trimmed)) addMemory({ type: 'promise', content: trimmed });
        }
        await addActions(actions, trimmed);
      } catch {
        setStatusLine(lang === 'hi-IN' ? 'AI error — edit करके भेजें' : 'AI error — edit and resend');
        setState('confirm');
        setEditableText(trimmed);
      }
    },
    [lang, addActions],
  );

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const text = transcriptRef.current.trim();
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
    recordStartedAtRef.current = 0;

    if (text) {
      setState('confirm');
      setEditableText(text);
      setStatusLine(
        lang === 'hi-IN'
          ? 'सही है? ✓ Send करें या edit करें'
          : 'Correct? Tap Send or edit below',
      );
    } else {
      setState('idle');
      setStatusLine(lang === 'hi-IN' ? 'कुछ सुनाई नहीं दिया — फिर tap करें' : 'No speech heard — tap mic again');
    }
  }, [lang]);

  const startListening = useCallback(async () => {
    const SpeechCtor = getSpeechRecognitionCtor();
    if (!SpeechCtor) {
      setStatusLine(lang === 'hi-IN' ? 'Voice support नहीं — type करें' : 'Voice not supported — type below');
      return;
    }

    recognitionRef.current?.abort();
    setState('processing');
    setStatusLine(lang === 'hi-IN' ? 'Mic allow करें…' : 'Allow microphone…');
    setTranscript('');
    setEditableText('');
    transcriptRef.current = '';

    const mic = await requestMicrophoneAccess();
    if (mic === 'denied') {
      setState('idle');
      setStatusLine(lang === 'hi-IN' ? 'Settings में mic allow करें' : 'Enable mic in Settings');
      toast.error('Allow microphone access');
      return;
    }

    const recognition = new SpeechCtor();
    recognition.lang = lang === 'hi-IN' ? 'hi-IN' : 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    (recognition as any).maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      recordStartedAtRef.current = Date.now();
      setState('listening');
      setStatusLine(lang === 'hi-IN' ? 'बोलें… done होने पर Stop tap करें' : 'Speak naturally… tap Stop when done');
    };

    recognition.onresult = (event) => {
      const text = collectTranscript(event);
      transcriptRef.current = text;
      setTranscript(text);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (stateRef.current === 'listening' && transcriptRef.current.trim()) {
          stopListening();
        }
      }, 5000);
    };

    recognition.onerror = (event) => {
      const msg = speechErrorMessage(event.error);
      if (msg) {
        setStatusLine(msg);
        if (event.error !== 'no-speech') toast.error(msg);
      }
      setState('idle');
    };

    recognition.onend = () => {
      if (stateRef.current === 'listening') {
        const text = transcriptRef.current.trim();
        if (text) {
          setState('confirm');
          setEditableText(text);
          setStatusLine(
            lang === 'hi-IN'
              ? 'सही है? ✓ Send करें या edit करें'
              : 'Correct? Tap Send or edit below',
          );
        } else {
          setState('idle');
          setStatusLine(lang === 'hi-IN' ? 'कुछ सुनाई नहीं दिया' : 'No speech detected');
        }
      }
    };

    try {
      recognition.start();
    } catch {
      setState('idle');
      setStatusLine(lang === 'hi-IN' ? 'Mic start नहीं हुआ — type करें' : 'Mic failed — type below');
    }
  }, [stopListening, lang]);

  const handleMicTap = () => {
    if (state === 'processing') return;
    if (state === 'listening') {
      stopListening();
    } else {
      void startListening();
    }
  };

  const handleConfirmSend = () => {
    if (editableText.trim()) {
      void parseAndAdd(editableText);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl z-10 mx-0 sm:mx-4 overflow-hidden max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" /> {AI_COACH_NAME} AI
            {aiEnabled && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                AI
              </span>
            )}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 touch-manipulation">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* Language toggle */}
          <div className="flex gap-2 mb-4">
            {(['hi-IN', 'en-US'] as VoiceLang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => changeLang(code)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-medium border touch-manipulation',
                  lang === code
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200',
                )}
              >
                {code === 'hi-IN' ? 'हिंदी' : 'English'}
              </button>
            ))}
          </div>

          {/* How it works */}
          <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-4">
            {lang === 'hi-IN'
              ? 'Mic tap → बोलें → check करें → Send → AI task/expense/shopping बना देगा'
              : 'Tap mic → speak → review what was heard → Send → AI creates items'}
          </p>

          {/* Mic button */}
          {micAvailable && state !== 'confirm' && (
            <div className="text-center mb-5">
              <button
                type="button"
                onClick={handleMicTap}
                disabled={state === 'processing'}
                className={cn(
                  'w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white shadow-lg touch-manipulation select-none transition-all duration-200',
                  state === 'listening'
                    ? 'bg-red-500 scale-110 ring-4 ring-red-200'
                    : state === 'processing'
                      ? 'bg-gray-400'
                      : 'bg-violet-600 active:scale-95',
                )}
              >
                {state === 'processing' ? (
                  <Loader2 size={36} className="animate-spin" />
                ) : state === 'listening' ? (
                  <Square size={32} fill="white" />
                ) : (
                  <Mic size={36} />
                )}
              </button>

              {state === 'listening' && recordSeconds > 0 && (
                <p className="mt-2 text-xs font-mono text-red-600 tabular-nums animate-pulse">
                  {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
                </p>
              )}

              <p className="mt-3 text-sm font-semibold">
                {state === 'listening'
                  ? lang === 'hi-IN'
                    ? 'सुन रहा हूँ… Stop करने के लिए tap करें'
                    : 'Listening… tap to stop'
                  : state === 'processing'
                    ? lang === 'hi-IN'
                      ? 'AI decide कर रहा है…'
                      : 'AI processing…'
                    : lang === 'hi-IN'
                      ? 'Mic tap करें और बोलें'
                      : 'Tap mic and speak'}
              </p>

              {/* Live transcript preview */}
              {transcript && state === 'listening' && (
                <div className="mt-3 mx-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {lang === 'hi-IN' ? 'सुन रहा:' : 'Hearing:'}
                  </p>
                  <p className="text-sm text-gray-800 italic">&ldquo;{transcript}&rdquo;</p>
                </div>
              )}
            </div>
          )}

          {!micAvailable && state !== 'confirm' && (
            <div className="mb-4 px-3 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              {lang === 'hi-IN'
                ? 'इस browser पर voice नहीं चलेगा — नीचे type करें'
                : 'Voice not supported in this browser — type below'}
            </div>
          )}

          {/* Confirmation step — user can edit before sending */}
          {state === 'confirm' && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Pencil size={14} className="text-amber-600" />
                <p className="text-xs font-bold text-amber-800">
                  {lang === 'hi-IN' ? 'गलत सुना? नीचे सही लिखें:' : 'Wrong? Fix it below:'}
                </p>
              </div>
              <p className="text-[11px] text-amber-700 mb-2">
                {lang === 'hi-IN'
                  ? 'Voice गलत सुनता है — सही text लिखकर Send करें'
                  : 'Voice often mishears — type the correct text and Send'}
              </p>
              <textarea
                ref={confirmInputRef}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleConfirmSend();
                  }
                }}
                rows={3}
                className="w-full px-3 py-3 border border-amber-300 rounded-xl text-base outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white font-medium"
                placeholder={lang === 'hi-IN' ? 'e.g. aaj 200 ki sabji mangayi online' : 'e.g. today spent 200 on vegetables online'}
                autoComplete="off"
              />
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleConfirmSend}
                  disabled={!editableText.trim()}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 touch-manipulation flex items-center justify-center gap-1.5"
                >
                  <Check size={16} /> {lang === 'hi-IN' ? 'AI को भेजें' : 'Send to AI'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditableText(''); setState('idle'); }}
                  className="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium touch-manipulation"
                >
                  {lang === 'hi-IN' ? 'Cancel' : 'Clear'}
                </button>
              </div>
            </div>
          )}

          {statusLine && <p className="text-xs text-gray-500 mb-3 text-center">{statusLine}</p>}

          {/* Recently added items */}
          {addedItems.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                <Check size={14} /> {lang === 'hi-IN' ? 'Add हो गया:' : 'Added:'}
              </p>
              <ul className="space-y-1 text-sm text-emerald-900">
                {addedItems.slice(0, 8).map((desc, i) => (
                  <li key={i}>• {desc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Text input fallback */}
          {state !== 'confirm' && (
            <div className={micAvailable ? 'border-t pt-4' : ''}>
              <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <Keyboard size={14} /> {lang === 'hi-IN' ? 'Type करें (ज़्यादा accurate)' : 'Type instead (more accurate)'}
              </p>
              <p className="text-[11px] text-gray-400 mb-2">
                {lang === 'hi-IN'
                  ? 'Hindi/English dono chalega: "200 sabji online", "milk lana", "gym task kal"'
                  : 'Examples: "200 spent groceries", "buy milk", "gym tomorrow"'}
              </p>
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textInputRef}
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void parseAndAdd(editableText);
                    }
                  }}
                  placeholder={hints[0]}
                  rows={2}
                  className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none font-medium"
                  autoComplete="off"
                  enterKeyHint="done"
                />
                <button
                  type="button"
                  onClick={() => void parseAndAdd(editableText)}
                  disabled={!editableText.trim() || state === 'processing'}
                  className="px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation shrink-0"
                >
                  {lang === 'hi-IN' ? 'भेजें' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {/* Examples */}
          {state === 'idle' && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {lang === 'hi-IN' ? 'उदाहरण' : 'Examples'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {hints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => {
                      setEditableText(hint);
                      void parseAndAdd(hint);
                    }}
                    className="text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 touch-manipulation"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface VoiceMicButtonProps {
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VoiceMicButton({ onClick, className, size = 'md' }: VoiceMicButtonProps) {
  const dims = size === 'lg' ? 'w-11 h-11' : size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  const icon = size === 'lg' ? 22 : size === 'sm' ? 16 : 20;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Rozka AI — speak or type"
      className={cn(
        dims,
        'rounded-full bg-violet-600 text-white flex items-center justify-center shadow-md active:scale-95 touch-manipulation',
        className,
      )}
    >
      <Mic size={icon} />
    </button>
  );
}
