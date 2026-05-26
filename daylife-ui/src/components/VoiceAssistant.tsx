import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mic, Loader2, Sparkles, X, Keyboard } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { toast } from './Toaster';
import { cn } from '../lib/utils';
import { parseVoiceTranscript, describeVoiceAction, VOICE_HINTS, type VoiceAction } from '../lib/voiceCommands';
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

export function VoiceAssistantSheet({ open, onClose }: VoiceAssistantSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [preview, setPreview] = useState<VoiceAction[]>([]);
  const [statusLine, setStatusLine] = useState('');
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

  const runActions = useCallback(
    async (actions: VoiceAction[]) => {
      if (!user?.id || actions.length === 0) {
        setStatusLine('Could not understand — see examples below');
        setState('idle');
        return;
      }
      setState('processing');
      setStatusLine('Adding…');
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
        setStatusLine(`Could not add: ${result.failed.join(', ')}`);
        toast.error('Some items could not be added');
      }
      if (result.ok.length === 0 && result.failed.length === 0) {
        setStatusLine('Nothing matched — try "task buy milk"');
      }
    },
    [user?.id, queryClient, onClose],
  );

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTranscript(trimmed);
      const actions = parseVoiceTranscript(trimmed);
      setPreview(actions);
      if (actions.length > 0) {
        void runActions(actions);
      } else {
        setStatusLine('Try: "task buy milk" or "spent 15 on coffee"');
        setState('idle');
      }
    },
    [runActions],
  );

  const finishListening = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      const text = transcriptRef.current.trim();
      holdingRef.current = false;
      if (text) {
        submitText(text);
      } else {
        setState('idle');
        setStatusLine('No speech heard — hold mic and try again');
      }
    }, 400);
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
      setStatusLine('Use the text box below — voice is not supported on iPhone');
      return;
    }

    recognitionRef.current?.abort();
    setState('processing');
    setStatusLine('Allow microphone if asked…');
    setTranscript('');
    setPreview([]);
    transcriptRef.current = '';

    const mic = await requestMicrophoneAccess();
    if (mic === 'denied') {
      setState('idle');
      setStatusLine('Microphone blocked — enable in phone Settings, or type below');
      toast.error('Allow microphone access');
      return;
    }

    const recognition = new SpeechCtor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setState('listening');
      setStatusLine('Listening… speak now');
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
        toast.error(msg);
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
      setStatusLine('Could not start mic — type below instead');
      toast.error('Could not start microphone');
    }
  }, [finishListening]);

  const handleHoldStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (state === 'processing') return;
    holdingRef.current = true;
    void startListening();
  };

  const handleHoldEnd = () => {
    if (!holdingRef.current && state !== 'listening') return;
    holdingRef.current = false;
    stopRecognition();
    finishListening();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl z-10 mx-0 sm:mx-4 overflow-hidden max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" /> Quick add
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 touch-manipulation">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {onIOS && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              iPhone does not support voice in the browser. Type below — same smart add.
            </div>
          )}

          {voiceSupported && (
            <div className="text-center mb-5">
              <button
                type="button"
                onPointerDown={handleHoldStart}
                onPointerUp={handleHoldEnd}
                onPointerLeave={handleHoldEnd}
                onPointerCancel={handleHoldEnd}
                disabled={state === 'processing'}
                className={cn(
                  'w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white shadow-lg transition-all touch-manipulation select-none',
                  state === 'listening'
                    ? 'bg-red-500 scale-110 ring-4 ring-red-200'
                    : state === 'processing'
                      ? 'bg-gray-400'
                      : 'bg-violet-600 active:scale-95 active:bg-violet-700',
                )}
              >
                {state === 'processing' ? (
                  <Loader2 size={36} className="animate-spin" />
                ) : (
                  <Mic size={36} />
                )}
              </button>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                {state === 'listening' ? 'Release when done' : 'Hold to speak'}
              </p>
              {transcript && (
                <p className="mt-2 text-sm text-gray-600 italic px-2">&ldquo;{transcript}&rdquo;</p>
              )}
              {statusLine && (
                <p className="mt-2 text-xs text-gray-500 px-2">{statusLine}</p>
              )}
              {preview.length > 0 && state === 'processing' && (
                <ul className="mt-3 text-left text-sm space-y-1">
                  {preview.map((a, i) => (
                    <li key={i} className="text-green-700">
                      ✓ {describeVoiceAction(a)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className={voiceSupported ? 'border-t pt-4' : ''}>
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              <Keyboard size={14} /> {voiceSupported ? 'Or type' : 'Type to add'}
            </p>
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitText(typed);
                    setTyped('');
                  }
                }}
                placeholder="task buy milk"
                className="flex-1 px-3 py-3 border rounded-xl text-base outline-none focus:ring-2 focus:ring-brand-500"
                autoComplete="off"
                enterKeyHint="done"
              />
              <button
                type="button"
                onClick={() => {
                  submitText(typed);
                  setTyped('');
                }}
                disabled={!typed.trim() || state === 'processing'}
                className="px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation shrink-0"
              >
                Add
              </button>
            </div>
            {!voiceSupported && statusLine && (
              <p className="mt-2 text-xs text-gray-500">{statusLine}</p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Examples</p>
            <div className="flex flex-wrap gap-1.5">
              {VOICE_HINTS.slice(0, 4).map((hint) => (
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
      title="Quick add — voice or type"
      className={cn(
        dims,
        'rounded-full bg-violet-600 text-white flex items-center justify-center shadow-md hover:bg-violet-700 active:scale-95 touch-manipulation',
        className,
      )}
    >
      <Mic size={icon} />
    </button>
  );
}
