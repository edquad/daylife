export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  if (isIOSDevice()) return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Browser hold-to-speak (not available on iPhone Safari). */
export function isVoiceInputSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

/** Mic + cloud transcribe (Android/desktop fallback — not used on iPhone). */
export function isCloudMicSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOSDevice()) return false;
  return Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(import.meta.env.VITE_VOICE_PARSE_URL);
}

/** iPhone: use keyboard dictation into the text box, then AI parse (no AWS Transcribe). */
export function isIOSDictationMode(): boolean {
  return isIOSDevice() && Boolean(import.meta.env.VITE_VOICE_PARSE_URL);
}

export function isVoiceMicAvailable(): boolean {
  return isVoiceInputSupported() || isCloudMicSupported() || isIOSDictationMode();
}

export async function requestMicrophoneAccess(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    return 'unavailable';
  }
}

export function collectTranscript(event: SpeechRecognitionEvent): string {
  let text = '';
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i][0].transcript;
  }
  return text.trim();
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone blocked — allow it in phone Settings → browser → Rozka';
    case 'no-speech':
      return 'Did not hear anything — hold mic and speak clearly';
    case 'network':
      return 'Voice needs internet — check your connection';
    case 'audio-capture':
      return 'No microphone found on this device';
    case 'aborted':
      return '';
    default:
      return 'Voice failed — try typing below instead';
  }
}

function downsample(samples: number[], fromRate: number, toRate: number): number[] {
  if (fromRate <= toRate) return samples;
  const ratio = fromRate / toRate;
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += ratio) {
    out.push(samples[Math.floor(i)] ?? 0);
  }
  return out;
}

function floatTo16BitPcm(input: number[]): Uint8Array {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export interface RecordedVoiceClip {
  base64: string;
  sampleRate: number;
}

/** Record short speech as PCM for AWS Transcribe (iPhone + any browser without Web Speech). */
export async function recordPcmVoiceClip(options: {
  maxMs?: number;
  signal?: AbortSignal;
  onStart?: () => void;
}): Promise<RecordedVoiceClip | null> {
  const maxMs = options.maxMs ?? 25000;
  if (!navigator.mediaDevices?.getUserMedia) return null;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const audioContext = new AudioContext();
  const targetRate = 16000;
  const source = audioContext.createMediaStreamSource(stream);
  const samples: number[] = [];

  await audioContext.resume();

  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) samples.push(input[i]);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
  options.onStart?.();

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, maxMs);
    if (options.signal) {
      options.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    }
  });

  processor.disconnect();
  source.disconnect();
  stream.getTracks().forEach((t) => t.stop());

  const inputRate = audioContext.sampleRate;
  await audioContext.close();

  if (samples.length < inputRate * 0.25) return null;

  const pcm16 = floatTo16BitPcm(downsample(samples, inputRate, targetRate));
  return {
    base64: arrayBufferToBase64(Uint8Array.from(pcm16)),
    sampleRate: targetRate,
  };
}
