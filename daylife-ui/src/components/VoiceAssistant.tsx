import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mic, Loader2, Sparkles, X, Keyboard, Check } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { toast } from './Toaster';
import { cn } from '../lib/utils';
import {
  describeVoiceAction,
  getVoiceHints,
  getVoiceLang,
  setVoiceLang,
  type VoiceAction,
  type VoiceLang,
} from '../lib/voiceCommands';
import { parseVoiceTranscriptSmart, transcribeAndParseVoice, voiceAiSupported } from '../lib/voiceBedrock';
import { executeVoiceActions, voiceQueryKeysToInvalidate } from '../lib/executeVoiceCommands';
import {
  collectTranscript,
  getSpeechRecognitionCtor,
  isCloudMicSupported,
  isIOSDevice,
  isIOSDictationMode,
  isVoiceInputSupported,
  isVoiceMicAvailable,
  recordPcmVoiceClip,
  requestMicrophoneAccess,
  speechErrorMessage,
} from '../lib/speechRecognition';

type VoiceState = 'idle' | 'listening' | 'processing' | 'preview';

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
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState<VoiceAction[]>([]);
  const [statusLine, setStatusLine] = useState('');
  const [holdToSpeak] = useState(isVoiceInputSupported());
  const [cloudMic] = useState(isCloudMicSupported());
  const [iosDictation] = useState(isIOSDictationMode());
  const [micAvailable] = useState(isVoiceMicAvailable());
  const [onIOS] = useState(isIOSDevice());
  const [aiEnabled] = useState(voiceAiSupported());
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const holdingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordAbortRef = useRef<AbortController | null>(null);
  const recordingRef = useRef(false);

  const hints = getVoiceHints(lang);

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.abort();
      recordAbortRef.current?.abort();
      holdingRef.current = false;
      recordingRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      setState('idle');
      setTranscript('');
      setTyped('');
      setPending([]);
      setStatusLine('');
    }
  }, [open]);

  const changeLang = (next: VoiceLang) => {
    setLang(next);
    setVoiceLang(next);
  };

  const runActions = useCallback(
    async (actions: VoiceAction[]) => {
      if (!user?.id || actions.length === 0) {
        setStatusLine(lang === 'hi-IN' ? 'समझ नहीं आया — नीचे example देखें' : 'Could not understand — see examples');
        setState('idle');
        return;
      }
      setState('processing');
      setStatusLine(lang === 'hi-IN' ? 'जोड़ रहे हैं…' : 'Adding…');
      const result = await executeVoiceActions(actions, user.id);
      voiceQueryKeysToInvalidate().forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      setPending([]);
      setState('idle');
      if (result.ok.length > 0) {
        toast.success(
          lang === 'hi-IN'
            ? `${result.ok.length} चीज़ add हो गई`
            : `Added ${result.ok.length} item${result.ok.length > 1 ? 's' : ''}`,
        );
        onClose();
      }
      if (result.failed.length > 0) {
        setStatusLine(`Failed: ${result.failed.join(', ')}`);
        toast.error('Some items could not be added');
      }
    },
    [user?.id, queryClient, onClose, lang],
  );

  const parseTranscript = useCallback(async (text: string): Promise<VoiceAction[]> => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    setTranscript(trimmed);
    setStatusLine(lang === 'hi-IN' ? 'AI समझ रहा है…' : 'AI understanding…');
    const { actions } = await parseVoiceTranscriptSmart(trimmed, lang);
    return actions;
  }, [lang]);

  const submitText = useCallback(
    async (text: string, autoAdd = false) => {
      setState('processing');
      const actions = await parseTranscript(text);
      if (actions.length === 0) {
        setStatusLine(
          lang === 'hi-IN'
            ? 'बोलें: 2 task doodh aur sabzi, yaad dilana'
            : 'Try: create 2 tasks order milk and veggies, remind me',
        );
        setState('idle');
        return;
      }
      setPending(actions);
      setState('preview');
      setStatusLine(
        lang === 'hi-IN'
          ? `${actions.length} चीज़ — सही है? गलत हो तो नीचे edit करें`
          : `${actions.length} item(s) — correct? edit below if wrong`,
      );
      if (autoAdd) {
        void runActions(actions);
      }
    },
    [parseTranscript, lang, runActions],
  );

  const finishListening = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      const text = transcriptRef.current.trim();
      holdingRef.current = false;
      if (text) {
        setTyped(text);
        void submitText(text, false);
      } else {
        setState('idle');
        setStatusLine(lang === 'hi-IN' ? 'कुछ सुनाई नहीं दिया — फिर hold करें' : 'No speech heard — hold mic again');
      }
    }, 500);
  }, [submitText, lang]);

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
      setStatusLine(lang === 'hi-IN' ? 'iPhone पर type करें' : 'Use text box on iPhone');
      return;
    }

    recognitionRef.current?.abort();
    setState('processing');
    setStatusLine(lang === 'hi-IN' ? 'Mic allow करें…' : 'Allow microphone…');
    setTranscript('');
    setPending([]);
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
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setState('listening');
      setStatusLine(lang === 'hi-IN' ? 'बोलें… (Hindi / English)' : 'Speak now…');
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
      setStatusLine(lang === 'hi-IN' ? 'Mic start नहीं हुआ — type करें' : 'Mic failed — type below');
    }
  }, [finishListening, lang]);

  const stopCloudRecording = useCallback(() => {
    recordAbortRef.current?.abort();
  }, []);

  const startCloudRecording = useCallback(async () => {
    if (recordingRef.current || !cloudMic) return;

    setState('processing');
    setStatusLine(lang === 'hi-IN' ? 'Mic allow करें…' : 'Allow microphone…');
    setTranscript('');
    setPending([]);

    const mic = await requestMicrophoneAccess();
    if (mic === 'denied') {
      setState('idle');
      setStatusLine(lang === 'hi-IN' ? 'Settings में mic allow करें' : 'Enable mic in Settings');
      toast.error('Allow microphone access');
      return;
    }
    if (mic === 'unavailable') {
      setState('idle');
      setStatusLine(lang === 'hi-IN' ? 'Mic उपलब्ध नहीं' : 'Microphone unavailable');
      return;
    }

    recordingRef.current = true;
    recordAbortRef.current = new AbortController();
    setState('listening');
    setStatusLine(
      lang === 'hi-IN'
        ? 'बोलें… फिर mic दबाकर रोकें'
        : 'Speak… tap mic again to stop',
    );

    try {
      const clip = await recordPcmVoiceClip({
        signal: recordAbortRef.current.signal,
        maxMs: 25000,
      });
      recordingRef.current = false;
      if (!clip) {
        setState('idle');
        setStatusLine(
          lang === 'hi-IN' ? 'आवाज़ नहीं सुनी — फिर कोशिश करें' : 'No speech heard — try again',
        );
        return;
      }

      setState('processing');
      setStatusLine(lang === 'hi-IN' ? 'AI सुन रहा है…' : 'AI listening…');
      const { transcript: heard, actions } = await transcribeAndParseVoice(clip, lang);
      if (heard) setTranscript(heard);
      if (actions.length === 0) {
        setStatusLine(
          lang === 'hi-IN' ? 'समझ नहीं आया — नीचे edit करके Parse' : 'Could not understand — edit text below and Parse',
        );
        setState('idle');
        return;
      }
      setPending(actions);
      setState('preview');
      setStatusLine(
        lang === 'hi-IN'
          ? `${actions.length} चीज़ — सही है? Add दबाएं`
          : `${actions.length} item(s) — correct? tap Add`,
      );
    } catch (err) {
      recordingRef.current = false;
      setState('idle');
      const msg = err instanceof Error ? err.message : 'Voice failed';
      setStatusLine(msg);
      toast.error(msg);
    }
  }, [cloudMic, lang, runActions]);

  const handleMicTap = () => {
    if (holdToSpeak || state === 'processing') return;
    if (iosDictation) {
      textInputRef.current?.focus();
      setStatusLine(
        lang === 'hi-IN'
          ? 'Keyboard के 🎤 से बोलें, फिर Parse दबाएं'
          : 'Tap 🎤 on your keyboard to speak, then Parse',
      );
      return;
    }
    if (state === 'listening') {
      stopCloudRecording();
      return;
    }
    void startCloudRecording();
  };

  const handleHoldStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!holdToSpeak || state === 'processing') return;
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
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" /> Quick add
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

          {aiEnabled && (
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-4">
              {lang === 'hi-IN'
                ? 'गलत pronunciation भी ठीक — बोलें “doodh sabzi task, yaad dilana”'
                : 'Bad pronunciation OK — AI fixes it. Say “order milk and veggies, remind me”'}
            </p>
          )}

          {onIOS && iosDictation && (
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 mb-4">
              {lang === 'hi-IN'
                ? 'iPhone: नीचे box में tap करें → keyboard पर 🎤 से Hindi/English बोलें → Parse'
                : 'iPhone: tap the box → use keyboard 🎤 to speak → tap Parse (AI adds tasks)'}
            </p>
          )}

          {onIOS && !iosDictation && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {lang === 'hi-IN'
                ? 'Voice के लिए app refresh करें — या नीचे type करें'
                : 'Refresh the app for voice — or type below'}
            </div>
          )}

          {micAvailable && (
            <div className="text-center mb-5">
              <button
                type="button"
                onPointerDown={holdToSpeak ? handleHoldStart : undefined}
                onPointerUp={holdToSpeak ? handleHoldEnd : undefined}
                onPointerLeave={holdToSpeak ? handleHoldEnd : undefined}
                onPointerCancel={holdToSpeak ? handleHoldEnd : undefined}
                onClick={holdToSpeak ? undefined : handleMicTap}
                disabled={state === 'processing' && !recordingRef.current && !iosDictation}
                className={cn(
                  'w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white shadow-lg touch-manipulation select-none',
                  state === 'listening'
                    ? 'bg-red-500 scale-110 ring-4 ring-red-200'
                    : state === 'processing'
                      ? 'bg-gray-400'
                      : 'bg-violet-600 active:scale-95',
                )}
              >
                {state === 'processing' && !recordingRef.current ? (
                  <Loader2 size={36} className="animate-spin" />
                ) : (
                  <Mic size={36} />
                )}
              </button>
              <p className="mt-3 text-sm font-semibold">
                {state === 'listening'
                  ? holdToSpeak
                    ? lang === 'hi-IN'
                      ? 'छोड़ें जब बोल लें'
                      : 'Release when done'
                    : lang === 'hi-IN'
                      ? 'बोलें — रोकने mic दबाएं'
                      : 'Tap mic again to stop'
                  : holdToSpeak
                    ? lang === 'hi-IN'
                      ? 'Hold करके बोलें'
                      : 'Hold to speak'
                  : iosDictation
                    ? lang === 'hi-IN'
                      ? 'Keyboard 🎤 के लिए tap'
                      : 'Tap for keyboard voice'
                    : lang === 'hi-IN'
                      ? 'Mic दबाकर बोलें'
                      : 'Tap mic to speak'}
              </p>
              {transcript && (
                <p className="mt-2 text-sm text-gray-600 italic px-2">&ldquo;{transcript}&rdquo;</p>
              )}
            </div>
          )}

          {pending.length > 0 && state === 'preview' && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200">
              {transcript && (
                <p className="text-xs text-green-900 mb-2 pb-2 border-b border-green-200">
                  <span className="font-semibold">{lang === 'hi-IN' ? 'सुना:' : 'Heard:'}</span>{' '}
                  &ldquo;{transcript}&rdquo;
                </p>
              )}
              <p className="text-xs font-semibold text-green-800 mb-2">
                {lang === 'hi-IN' ? 'ये add होगा:' : 'Will add:'}
              </p>
              <ul className="space-y-1 text-sm text-green-900">
                {pending.map((a, i) => (
                  <li key={i}>• {describeVoiceAction(a)}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void runActions(pending)}
                className="mt-3 w-full py-3 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 touch-manipulation"
              >
                <Check size={18} /> {lang === 'hi-IN' ? 'Add करें' : 'Add now'}
              </button>
            </div>
          )}

          {statusLine && <p className="text-xs text-gray-500 mb-3 text-center">{statusLine}</p>}

          <div className={micAvailable ? 'border-t pt-4' : ''}>
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              <Keyboard size={14} /> {lang === 'hi-IN' ? 'Type करें' : 'Or type'}
            </p>
            <div className="flex gap-2 items-end">
              <textarea
                ref={textInputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submitText(typed, false);
                  }
                }}
                placeholder={hints[0]}
                rows={2}
                className="flex-1 px-3 py-3 border rounded-xl text-base outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                autoComplete="off"
                enterKeyHint="done"
              />
              <button
                type="button"
                onClick={() => void submitText(typed, false)}
                disabled={!typed.trim() || state === 'processing'}
                className="px-4 py-3 bg-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 touch-manipulation shrink-0"
              >
                {lang === 'hi-IN' ? 'देखें' : 'Parse'}
              </button>
            </div>
          </div>

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
                    setTyped(hint);
                    void submitText(hint, false);
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
      title="Quick add — Hindi / English"
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
