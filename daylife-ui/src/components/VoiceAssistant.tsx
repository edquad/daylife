import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, Loader2, Sparkles, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { toast } from './Toaster';
import { cn } from '../lib/utils';
import { parseVoiceTranscript, describeVoiceAction, VOICE_HINTS, type VoiceAction } from '../lib/voiceCommands';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../lib/executeVoiceCommands';

type VoiceState = 'idle' | 'listening' | 'processing';

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

interface VoiceAssistantSheetProps {
  open: boolean;
  onClose: () => void;
}

export function VoiceAssistantSheet({ open, onClose }: VoiceAssistantSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [preview, setPreview] = useState<VoiceAction[]>([]);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.abort();
      setState('idle');
      setTranscript('');
      setPreview([]);
    }
  }, [open]);

  const runActions = useCallback(
    async (actions: VoiceAction[]) => {
      if (!user?.id || actions.length === 0) {
        toast.error('Could not understand — try again');
        return;
      }
      setState('processing');
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
        toast.error(`Could not add: ${result.failed.join(', ')}`);
      }
      if (result.ok.length === 0 && result.failed.length === 0) {
        toast.error('Nothing to add — check your words');
      }
    },
    [user?.id, queryClient, onClose],
  );

  const handleTranscript = useCallback(
    (text: string) => {
      setTranscript(text);
      const actions = parseVoiceTranscript(text);
      setPreview(actions);
      if (actions.length > 0) {
        void runActions(actions);
      } else if (text.trim()) {
        toast.error('Try: "task buy milk" or "spent 15 on coffee"');
        setState('idle');
      }
    },
    [runActions],
  );

  const startListening = useCallback(() => {
    const SpeechCtor = getSpeechRecognition();
    if (!SpeechCtor) {
      toast.error('Voice not supported in this browser — try Chrome');
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new SpeechCtor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalText = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText = result[0].transcript;
        } else {
          interim = result[0].transcript;
        }
      }
      setTranscript(finalText || interim);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        toast.error(event.error === 'not-allowed' ? 'Allow microphone access' : 'Voice failed — try again');
      }
      setState('idle');
    };

    recognition.onend = () => {
      if (finalText.trim()) {
        handleTranscript(finalText);
      } else {
        setState('idle');
      }
    };

    try {
      recognition.start();
      setState('listening');
      setTranscript('');
      setPreview([]);
    } catch {
      toast.error('Could not start microphone');
      setState('idle');
    }
  }, [handleTranscript]);

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl z-10 mx-0 sm:mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" /> Voice add
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 text-center">
          {!supported ? (
            <p className="text-sm text-gray-600">
              Voice works best in Chrome on Android or desktop. Type in the task box if voice is unavailable.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={state === 'listening' ? stopListening : startListening}
                disabled={state === 'processing'}
                className={cn(
                  'w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white shadow-lg transition-all touch-manipulation',
                  state === 'listening'
                    ? 'bg-red-500 animate-pulse scale-105'
                    : state === 'processing'
                      ? 'bg-gray-400'
                      : 'bg-brand-600 hover:bg-brand-700 active:scale-95',
                )}
              >
                {state === 'processing' ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : state === 'listening' ? (
                  <MicOff size={32} />
                ) : (
                  <Mic size={32} />
                )}
              </button>
              <p className="mt-4 text-sm font-medium text-gray-800">
                {state === 'listening'
                  ? 'Listening… tap to stop'
                  : state === 'processing'
                    ? 'Adding…'
                    : 'Tap mic and speak'}
              </p>
              {transcript && (
                <p className="mt-2 text-sm text-gray-500 italic">&ldquo;{transcript}&rdquo;</p>
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
            </>
          )}

          <div className="mt-6 text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Try saying</p>
            <ul className="space-y-1.5">
              {VOICE_HINTS.slice(0, 4).map((hint) => (
                <li key={hint} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  &ldquo;{hint}&rdquo;
                </li>
              ))}
            </ul>
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
      title="Voice add — task, expense, shopping"
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
