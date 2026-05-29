import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useConnections } from '../hooks/useConnections';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  dismissNotificationPrompt,
  isNotificationPromptDismissed,
  notificationsPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../lib/pendingNotifications';

export function PendingNotificationsPrompt() {
  const [hidden, setHidden] = useState(() => isNotificationPromptDismissed());
  const { data: connections = [] } = useConnections({ syncInbox: false });
  const { isStandalone } = usePwaInstall();
  const pending = connections.filter((c) => c.status === 'pending_received').length;
  const permission = notificationsPermission();

  if (hidden || !notificationsSupported()) return null;
  if (permission === 'granted' || permission === 'denied') return null;
  if (!isStandalone && pending === 0) return null;

  const dismiss = () => {
    dismissNotificationPrompt();
    setHidden(true);
  };

  const enable = async () => {
    const ok = await requestNotificationPermission();
    if (ok) dismiss();
  };

  return (
    <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-200 flex items-start gap-2 text-sm">
      <Bell size={18} className="text-violet-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-violet-900">Get invite alerts on your phone</p>
        <p className="text-xs text-violet-700 mt-0.5">
          When someone invites you, we&apos;ll ping you even if the app is in the background.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            onClick={enable}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold touch-manipulation"
          >
            Turn on alerts
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-1.5 rounded-lg border border-violet-200 text-violet-800 text-xs touch-manipulation"
          >
            Not now
          </button>
        </div>
      </div>
      <button type="button" onClick={dismiss} className="text-violet-400 shrink-0 p-1" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
