import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { useGitHubSync } from '../../features/sync/GitHubSyncContext';
import { useChatUnreadCount } from '../../hooks/useChatUnread';
import { DayPicker } from '../DayPicker';
import { InstallAppBanner } from '../InstallAppBanner';
import { PendingNotificationsPrompt } from '../PendingNotificationsPrompt';
import { PendingNotificationsWatcher } from '../PendingNotificationsWatcher';
import { SharedTaskReminderWatcher } from '../SharedTaskReminderWatcher';
import { ChatNotificationWatcher } from '../ChatNotificationWatcher';
import { AppLogo } from '../AppLogo';
import { APP_NAME } from '../../lib/brand';
import {
  LayoutDashboard, Receipt, Mic, MessageCircle,
  MoreHorizontal, Cloud, CloudOff, Loader2, LogOut,
} from 'lucide-react';
import { VoiceAssistantSheet } from '../VoiceAssistant';
import { RecoveryCodeModal } from '../RecoveryCodeModal';
import { cn } from '../../lib/utils';

const bottomTabs = [
  { path: '/', label: 'Today', icon: LayoutDashboard },
  { path: '/money', label: 'Money', icon: Receipt },
  { path: '/__voice__', label: 'Rozka', icon: Mic, isVoice: true },
  { path: '/comms', label: 'Chat', icon: MessageCircle },
  { path: '/more', label: 'More', icon: MoreHorizontal },
] as const;

export function AppShell() {
  const { user, logout, pendingRecoveryCode, acknowledgeRecoveryCode } = useAuth();
  const { status, statusMessage, cloudReady } = useGitHubSync();
  const location = useLocation();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const chatUnreadCount = useChatUnreadCount();

  useEffect(() => {
    const openVoice = () => setVoiceOpen(true);
    window.addEventListener('rozka-open-voice', openVoice);
    return () => window.removeEventListener('rozka-open-voice', openVoice);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <PendingNotificationsWatcher />
      <SharedTaskReminderWatcher />
      <ChatNotificationWatcher />
      {pendingRecoveryCode && (
        <RecoveryCodeModal code={pendingRecoveryCode} onClose={acknowledgeRecoveryCode} />
      )}

      {/* Top bar */}
      <header className="border-b bg-white sticky top-0 z-30">
        <div className="h-14 flex items-center px-4 gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <AppLogo size="sm" showShadow={false} />
            <span className="text-sm font-bold text-brand-700 hidden sm:inline">{APP_NAME}</span>
          </div>
          <div className="hidden md:block">
            <DayPicker compact />
          </div>
          <div className="flex-1" />
          {cloudReady && (
            <Link
              to="/settings"
              title={statusMessage || 'Cloud sync'}
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0',
                status === 'error' ? 'bg-red-50 text-red-700' :
                status === 'syncing' ? 'bg-amber-50 text-amber-700' :
                'bg-green-50 text-green-700',
              )}
            >
              {status === 'syncing' ? <Loader2 size={14} className="animate-spin" /> :
                status === 'error' ? <CloudOff size={14} /> : <Cloud size={14} />}
              {status === 'syncing' ? 'Saving…' : status === 'error' ? 'Sync issue' : 'Saved'}
            </Link>
          )}
          <div className="flex items-center gap-2 px-2 text-xs text-gray-600">
            <span
              className="w-7 h-7 rounded-full text-white text-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: user?.color }}
            >
              {user?.name?.[0]}
            </span>
            <span className="truncate hidden sm:inline font-medium max-w-[100px]">{user?.name}</span>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 shrink-0" title="Log out">
            <LogOut size={16} />
          </button>
        </div>
        <div className="md:hidden px-4 pb-3">
          <DayPicker compact className="justify-center" />
        </div>
        <InstallAppBanner />
        <PendingNotificationsPrompt />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-6">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40 pb-safe">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;

            if ('isVoice' in tab && tab.isVoice) {
              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => setVoiceOpen(true)}
                  className="flex flex-col items-center gap-0.5 touch-manipulation"
                >
                  <div className="w-14 h-14 -mt-7 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                    <Mic size={26} />
                  </div>
                  <span className="text-[10px] font-medium text-violet-600">{tab.label}</span>
                </button>
              );
            }

            const active = isActive(tab.path);
            const badge = tab.path === '/comms' && chatUnreadCount > 0 ? chatUnreadCount : 0;

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 min-w-[3.5rem] touch-manipulation',
                  active ? 'text-brand-700' : 'text-gray-400',
                )}
              >
                <span className="relative">
                  <Icon size={22} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <VoiceAssistantSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  );
}
