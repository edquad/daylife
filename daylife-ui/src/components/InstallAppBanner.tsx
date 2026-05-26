import { APP_NAME } from '../lib/brand';
import { Smartphone, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { AndroidInstallSteps, IosInstallSteps } from './InstallInstructions';

export function InstallAppBanner() {
  const {
    showBanner,
    showIosHint,
    showAndroidInstall,
    showAndroidHint,
    install,
    dismissBanner,
  } = usePwaInstall();

  if (!showBanner) return null;

  return (
    <div className="lg:hidden mx-4 mt-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-teal-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
          <Smartphone size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-900">Install {APP_NAME} on your phone</p>
          <p className="text-sm text-brand-800 mt-1">
            Same login, tasks & expenses as the website — synced automatically.
          </p>

          {showAndroidInstall && (
            <button
              type="button"
              onClick={() => install()}
              className="mt-3 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
            >
              Install app
            </button>
          )}

          {showAndroidHint && (
            <div className="mt-3 bg-white/70 rounded-xl p-3 border border-brand-100">
              <AndroidInstallSteps compact />
            </div>
          )}

          {showIosHint && (
            <div className="mt-3 bg-white/70 rounded-xl p-3 border border-brand-100">
              <IosInstallSteps compact />
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
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
