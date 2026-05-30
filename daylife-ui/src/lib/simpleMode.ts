const KEY = 'rozka_simple_mode';

/** Simple home screen — less clutter, big voice + today tasks only. */
export function getSimpleMode(): boolean {
  const v = localStorage.getItem(KEY);
  if (v === '0') return false;
  return true;
}

export function setSimpleMode(on: boolean): void {
  localStorage.setItem(KEY, on ? '1' : '0');
}
