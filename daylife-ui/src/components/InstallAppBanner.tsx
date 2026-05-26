import { Smartphone, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallAppBanner() {
  const { showBanner, showIosHint, showAndroidInstall, install, dismissBanner } = usePwaInstall();

  if (!showBanner) return null;

  return (
    <div className="lg:hidden mx-4 mt-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-teal-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-900">Install DayLife on your phone</p>
          {showAndroidInstall ? (
            <p className="text-sm text-brand-800 mt-1">
              Add to your home screen — same tasks & expenses as the website, synced via cloud.
            </p>
          ) : (
            <p className="text-sm text-brand-800 mt-1">
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> in Safari. Same data as web, synced automatically.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {showAndroidInstall && (
              <button
                type="button"
                onClick={() => install()}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
              >
                Install app
              </button>
            )}
            <button
              type="button"
              onClick={dismissBanner}
              className="px-4 py-2 border border-brand-200 text-brand-800 text-sm font-medium rounded-lg hover:bg-white/70"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissBanner}
          className="p-1 text-brand-600/70 hover:text-brand-800 shrink-0"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
