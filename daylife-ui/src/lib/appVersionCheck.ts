import { notifyAppUpdateAvailable } from './appUpdate';

/** If a newer build is on GitHub Pages, prompt user to reload (fixes stale PWA cache / 404 routes). */
export function checkForNewerAppBuild(): void {
  if (typeof window === 'undefined') return;
  const base = import.meta.env.BASE_URL || '/';
  const current =
    document.querySelector('meta[name="rozka-version"]')?.getAttribute('content') || '';

  const url = `${base}index.html`.replace(/\/+/g, '/');

  fetch(url, { cache: 'no-store' })
    .then((res) => (res.ok ? res.text() : ''))
    .then((html) => {
      if (!html) return;
      const match = html.match(/name="rozka-version"\s+content="([^"]+)"/);
      const live = match?.[1];
      // Old PWA installs have no version meta — prompt once live build is newer.
      if (live && live !== current) {
        notifyAppUpdateAvailable();
      }
    })
    .catch(() => undefined);
}
