const UNLOCK_KEY = 'daylife_unlocked_user';

export async function hashPin(pin: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin: string, userId: string, pinHash: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  const computed = await hashPin(pin, userId);
  return computed === pinHash;
}

export function markUserUnlocked(userId: string): void {
  sessionStorage.setItem(UNLOCK_KEY, userId);
}

export function clearUnlock(): void {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function isUserUnlocked(userId: string): boolean {
  return sessionStorage.getItem(UNLOCK_KEY) === userId;
}

export function validatePinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode(): string {
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += RECOVERY_CHARS[Math.floor(Math.random() * RECOVERY_CHARS.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeRecoveryCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatRecoveryCode(raw: string): string {
  const normalized = normalizeRecoveryCode(raw);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

export function validateRecoveryCodeFormat(code: string): boolean {
  return normalizeRecoveryCode(code).length === 8;
}

export async function hashRecoveryCode(code: string, userId: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  const data = new TextEncoder().encode(`recovery:${userId}:${normalized}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyRecoveryCode(code: string, userId: string, recoveryHash: string): Promise<boolean> {
  if (!validateRecoveryCodeFormat(code)) return false;
  const computed = await hashRecoveryCode(code, userId);
  return computed === recoveryHash;
}
