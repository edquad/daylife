import { todayISO } from './format';
import { useDateStore } from './dateStore';
import type { VoiceAction, VoiceLang } from './voiceCommands';
import { parseVoiceTranscript } from './voiceCommands';

const VOICE_PARSE_URL = (import.meta.env.VITE_VOICE_PARSE_URL || '').trim();

export function voiceAiSupported(): boolean {
  return Boolean(VOICE_PARSE_URL);
}

export async function parseVoiceTranscriptSmart(
  raw: string,
  lang: VoiceLang,
): Promise<{ actions: VoiceAction[]; source: 'bedrock' | 'local' }> {
  const text = raw.trim();
  if (!text) return { actions: [], source: 'local' };

  const selectedDate = useDateStore.getState().selectedDate || todayISO();
  const context = { selectedDate, today: todayISO(), lang };

  if (VOICE_PARSE_URL) {
    try {
      const res = await fetch(VOICE_PARSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, lang, context }),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; actions?: VoiceAction[] };
        if (data.ok && Array.isArray(data.actions) && data.actions.length > 0) {
          return { actions: data.actions, source: 'bedrock' };
        }
      }
    } catch {
      /* fall back to local parser */
    }
  }

  return { actions: parseVoiceTranscript(text), source: 'local' };
}
