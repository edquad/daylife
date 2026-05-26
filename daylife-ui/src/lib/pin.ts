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
