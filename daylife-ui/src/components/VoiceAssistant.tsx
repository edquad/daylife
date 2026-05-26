import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mic, Loader2, Sparkles, X, Keyboard, Check } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { toast } from './Toaster';
import { cn } from '../lib/utils';
import {
  parseVoiceTranscript,
  describeVoiceAction,
  hintsForLang,
  getVoiceLang,
  setVoiceLang,
  type VoiceAction,
  type VoiceLang,
} from '../lib/voiceCommands';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../lib/executeVoiceCommands';
import {
  collectTranscript,
  getSpeechRecognitionCtor,
  isIOSDevice,
  isVoiceInputSupported,
  requestMicrophoneAccess,
  speechErrorMessage,
} from '../lib/speechRecognition';

type VoiceState = 'idle' | 'listening' | 'processing';

interface VoiceAssistantSheetProps {
  open: boolean;
  onClose: () => void;
}

const LANG_OPTIONS: Array<{ id: VoiceLang; label: string }> = [
  { id: 'hi-IN', label: 'Hindi' },
  { id: 'en-IN', label: 'English (IN)' },
  { id: 'en-US', label: 'English (US)' },
];

export function VoiceAssistantSheet({ open, onClose }: VoiceAssistantSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [preview, setPreview] = useState<VoiceAction[]>([]);
  const [statusLine, setStatusLine] = useState('');
  const [lang, setLang] = useState<VoiceLang>(() => getVoiceLang());
  const [voiceSupported] = useState(isVoiceInputSupported());
  const [onIOS] = useState(isIOSDevice());
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const holdingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.abort();
      holdingRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      setState('idle');
      setTranscript('');
      setTyped('');
      setPreview([]);
      setStatusLine('');
    }
  }, [open]);

  const pickLang = (next: VoiceLang) => {
    setVoiceLang(next);
    setLang(next);
  };

  const runActions = useCallback(
    async (actions: VoiceAction[]) => {
      if (!user?.id || actions.length === 0) {
        setStatusLine('Samajh nahi aaya — neeche examples dekho');
        setState('idle');
        return;
      }
      setState('processing');
      setStatusLine('Add ho raha hai…');
      const result = await executeVoiceActions(actions, user.id);
      voiceQueryKeysToInvalidate().forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      setState('idle');
      if (result.ok.length > 0) {
        toast.success(`Added ${result.ok.length} item${result.ok.length > 1 ? 's' : ''}`);
        onClose();
      }
      if (result.failed.length > 0) {
        setStatusLine(`Failed: ${result.failed.join(', ')}`);
        toast.error('Could not add some items');
      }
    },
    [user?.id, queryClient, onClose],
  );

  const buildPreview = useCallback((text: string): VoiceAction[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    setTranscript(trimmed);
    const actions = parseVoiceTranscript(trimmed);
    setPreview(actions);
    return actions;
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const actions = buildPreview(text);
      if (actions.length === 0) {
        setStatusLine('Try: "kaam doodh lana" or "kharcha 500 sabzi"');
        setState('idle');
        return;
      }
      setStatusLine(`Found ${actions.length} item${actions.length > 1 ? 's' : ''} — tap Add below`);
    },
    [buildPreview],
  );

  const finishListening = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      const text = transcriptRef.current.trim();
      holdingRef.current = false;
      setState('idle');
      if (text) {
        submitText(text);
      } else {
        setStatusLine('Kuch sunai nahi diya — dubara boliye');
      }
    }, 500);
  }, [submitText]);

  const stopRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const startListening = useCallback(async () => {
    const SpeechCtor = getSpeechRecognitionCtor();
    if (!SpeechCtor) {
      setStatusLine('iPhone par type karein — neeche box');
      return;
    }

    recognitionRef.current?.abort();
    setState('processing');
    setStatusLine('Microphone allow karein…');
    setTranscript('');
    setPreview([]);
    transcriptRef.current = '';

    const mic = await requestMicrophoneAccess();
    if (mic === 'denied') {
      setState('idle');
      setStatusLine('Mic blocked — Settings se allow karein');
      toast.error('Allow microphone');
      return;
    }

    const recognition = new SpeechCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setState('listening');
      setStatusLine(lang.startsWith('hi') ? 'Boliye… Hindi ya English' : 'Speak now…');
    };

    recognition.onresult = (event) => {
      const text = collectTranscript(event);
      transcriptRef.current = text;
      setTranscript(text);
    };

    recognition.onerror = (event) => {
      const msg = speechErrorMessage(event.error);
      if (msg) {
        setStatusLine(msg);
        if (event.error !== 'no-speech') toast.error(msg);
      }
      holdingRef.current = false;
      setState('idle');
    };

    recognition.onend = () => {
      if (holdingRef.current) return;
      finishListening();
    };

    try {
      recognition.start();
    } catch {
      setState('idle');
      setStatusLine('Mic start nahi hua — type karein');
    }
  }, [finishListening, lang]);

  const handleHoldStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (state === 'processing' && preview.length === 0) return;
    holdingRef.current = true;
    setPreview([]);
    void startListening();
  };

  const handleHoldEnd = () => {
    if (!holdingRef.current && state !== 'listening') return;
    holdingRef.current = false;
    stopRecognition();
    finishListening();
  };

  if (!open) return null;

  const hints = hintsForLang(lang);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl z-10 mx-0 sm:mx-4 overflow-hidden max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" /> Bol kar add karein
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 touch-manipulation">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-1.5 mb-4">
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => pickLang(opt.id)}
                className={cn(
                  'flex-1 py-2 text-xs font-medium rounded-lg border touch-manipulation',
                  lang === opt.id
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {onIOS && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              iPhone: voice nahi chalega — neeche Hindi/English type karein, same add hoga.
            </div>
          )}

          {voiceSupported && (
            <div className="text-center mb-4">
              <button
                type="button"
                onPointerDown={handleHoldStart}
                onPointerUp={handleHoldEnd}
                onPointerLeave={handleHoldEnd}
                onPointerCancel={handleHoldEnd}
                disabled={state === 'processing' && preview.length === 0}
                className={cn(
                  'w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white shadow-lg touch-manipulation select-none',
                  state === 'listening'
                    ? 'bg-red-500 scale-110 ring-4 ring-red-200'
                    : state === 'processing' && preview.length === 0
                      ? 'bg-gray-400'
                      : 'bg-violet-600 active:scale-95',
                )}
              >
                {state === 'processing' && preview.length === 0 ? (
                  <Loader2 size={36} className="animate-spin" />
                ) : (
                  <Mic size={36} />
                )}
              </button>
              <p className="mt-3 text-sm font-semibold">
                {state === 'listening' ? 'Chhod dein jab bol lein' : 'Mic dabaye rakhein aur bolein'}
              </p>
            </div>
          )}

          {transcript && (
            <div className="mb-3 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-700">
              <span className="text-xs text-gray-400 block mb-1">Aapne kaha:</span>
              &ldquo;{transcript}&rdquo;
            </div>
          )}

          {preview.length > 0 && (
            <div className="mb-4 rounded-xl border-2 border-green-200 bg-green-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Yeh add hoga</p>
              {preview.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-green-900">
                  <Check size={16} className="shrink-0 text-green-600" />
                  {describeVoiceAction(a)}
                </div>
              ))}
              <button
                type="button"
                onClick={() => void runActions(preview)}
                disabled={state === 'processing'}
                className="w-full mt-2 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm touch-manipulation disabled:opacity-50"
              >
                {state === 'processing' ? 'Adding…' : 'Add to DayLife'}
              </button>
            </div>
          )}

          {statusLine && !preview.length && (
            <p className="mb-3 text-xs text-center text-gray-500">{statusLine}</p>
          )}

          <div className={voiceSupported ? 'border-t pt-4' : ''}>
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              <Keyboard size={14} /> Type karein (Hindi / English)
            </p>
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitText(typed);
                  }
                }}
                placeholder="kaam doodh lana"
                className="flex-1 px-3 py-3 border rounded-xl text-base outline-none focus:ring-2 focus:ring-brand-500"
                autoComplete="off"
                enterKeyHint="done"
              />
              <button
                type="button"
                onClick={() => submitText(typed)}
                disabled={!typed.trim()}
                className="px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation shrink-0"
              >
                Parse
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Examples</p>
            <div className="flex flex-wrap gap-1.5">
              {hints.slice(0, 5).map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => {
                    setTyped(hint);
                    submitText(hint);
                  }}
                  className="text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 touch-manipulation"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
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
      title="Bol kar add karein"
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
