import { todayISO } from './format';
import { useDateStore } from './dateStore';
import type { VoiceAction, VoiceLang } from './voiceCommands';
import { parseVoiceTranscript } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

export function voiceAiSupported(): boolean {
  return Boolean(VOICE_PARSE_URL);
}

function mergeActions(primary: VoiceAction[], fallback: VoiceAction[]): VoiceAction[] {
  if (primary.length === 0) return fallback;
  if (fallback.length > primary.length) return fallback;
  return primary;
}

export async function parseVoiceTranscriptSmart(
  raw: string,
  lang: VoiceLang,
): Promise<{ actions: VoiceAction[]; source: 'bedrock' | 'local' }> {
  const text = raw.trim();
  if (!text) return { actions: [], source: 'local' };

  const selectedDate = useDateStore.getState().selectedDate || todayISO();
  const context = { selectedDate, today: todayISO(), lang, bilingual: true };

  const localActions = parseVoiceTranscript(text);

  if (VOICE_PARSE_URL) {
    try {
      const res = await fetch(VOICE_PARSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, lang, context }),
      });
      const data = (await res.json()) as { ok?: boolean; actions?: VoiceAction[] };
      if (res.ok && data.ok && Array.isArray(data.actions) && data.actions.length > 0) {
        return { actions: mergeActions(data.actions, localActions), source: 'bedrock' };
      }
    } catch {
      /* fall back to local parser */
    }
  }

  return { actions: localActions, source: 'local' };
}

export async function transcribeAndParseVoice(
  audio: { base64: string; sampleRate: number },
  lang: VoiceLang,
): Promise<{ transcript: string; actions: VoiceAction[]; source: 'bedrock' | 'local' }> {
  const selectedDate = useDateStore.getState().selectedDate || todayISO();
  const context = { selectedDate, today: todayISO(), lang, bilingual: true };

  if (!VOICE_PARSE_URL) {
    return { transcript: '', actions: [], source: 'local' };
  }

  const res = await fetch(VOICE_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: audio.base64,
      audioEncoding: 'pcm',
      sampleRate: audio.sampleRate,
      lang,
      context,
    }),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    transcript?: string;
    actions?: VoiceAction[];
    error?: string;
  };

  if (!res.ok || !data.ok) {
    const raw = data.error || 'Voice transcription failed';
    if (/subscription/i.test(raw)) {
      throw new Error('Use keyboard microphone or type below — no paid AWS plan needed');
    }
    throw new Error(raw);
  }

  const transcript = (data.transcript || '').trim();
  const aiActions = Array.isArray(data.actions) ? data.actions : [];
  const localActions = transcript ? parseVoiceTranscript(transcript) : [];
  const actions = mergeActions(aiActions, localActions);
  const source = aiActions.length > 0 ? 'bedrock' : 'local';
  return { transcript, actions, source };
}
