import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyAppUpdate } from '../lib/appUpdate';

export function AppUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onUpdate = () => setShow(true);
    window.addEventListener('daylife-app-update-available', onUpdate);
    return () => window.removeEventListener('daylife-app-update-available', onUpdate);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-brand-700 text-white px-4 py-3 shadow-lg">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <RefreshCw size={18} className="shrink-0" />
        <p className="text-sm font-medium flex-1">
          New DayLife version — tap Update for username login & latest features
        </p>
        <button
          type="button"
          onClick={() => applyAppUpdate()}
          className="shrink-0 px-3 py-1.5 bg-white text-brand-800 rounded-lg text-sm font-semibold"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="shrink-0 p-1 text-white/80 hover:text-white"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
