let reloadApp: (() => void) | null = null;

export function setAppReloadHandler(fn: () => void): void {
  reloadApp = fn;
}

export function notifyAppUpdateAvailable(): void {
  window.dispatchEvent(new CustomEvent('daylife-app-update-available'));
}

export function applyAppUpdate(): void {
  if (reloadApp) reloadApp();
  else window.location.reload();
}

export async function checkForAppUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  await registration?.update();
}

export async function forceAppRefresh(): Promise<void> {
  await checkForAppUpdate();
  applyAppUpdate();
}
