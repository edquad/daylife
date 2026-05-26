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

export function isVoiceInputSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
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
      return 'Microphone blocked — allow it in phone Settings → browser → DayLife';
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
