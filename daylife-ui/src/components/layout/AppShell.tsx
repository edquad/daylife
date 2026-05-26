import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { useGitHubSync } from '../../features/sync/GitHubSyncContext';
import { api } from '../../lib/api';
import { DayPicker } from '../DayPicker';
import { InstallAppBanner } from '../InstallAppBanner';
import { APP_NAME, APP_TAGLINE } from '../../lib/brand';
import {
  LayoutDashboard, CheckSquare, Receipt, Briefcase, Home, Settings,
  Menu, X, Plus, LogOut, Heart, BarChart3, Sparkles, Cloud, CloudOff, Loader2, Star, HandCoins, Users, Mic,
} from 'lucide-react';
import { VoiceAssistantSheet, VoiceMicButton } from '../VoiceAssistant';

const baseNavItems = [
  { path: '/', label: 'Today', icon: LayoutDashboard },
  { path: '/tasks', label: 'All tasks', icon: CheckSquare },
  { path: '/share', label: 'Share', icon: Users },
  { path: '/daily', label: 'Daily life', icon: Sparkles },
  { path: '/vision', label: 'Vision board', icon: Star },
  { path: '/expenses', label: 'Expenses', icon: Receipt },
  { path: '/splits', label: 'Split money', icon: HandCoins },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/work', label: 'Work', icon: Briefcase },
  { path: '/home', label: 'Home', icon: Home },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const mobileBottomNav = [
  { path: '/', label: 'Day', icon: LayoutDashboard },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/expenses', label: 'Spend', icon: Receipt },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { status, statusMessage, cloudReady } = useGitHubSync();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const navItems = baseNavItems;

  const NavLink = ({ item, onClick }: { item: typeof baseNavItems[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
          active ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-600' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Icon size={18} />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-dvh flex">
      <aside className="hidden lg:flex flex-col w-64 border-r bg-white">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <Heart size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-700">{APP_NAME}</h1>
              <p className="text-xs text-gray-400">{APP_TAGLINE}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => <NavLink key={item.path} item={item} />)}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: user?.color }}>
                {user?.name?.[0]}
              </div>
              <div className="text-sm">
                <p className="font-medium">{user?.name}</p>
                <p className="text-gray-400 text-xs">Active now</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500" title="Log out">
              <LogOut size={16} />
            </button>
            <span className="text-xs text-gray-400 hidden xl:inline">Log out</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col z-10">
            <div className="p-4 border-b flex justify-between items-center">
              <h1 className="text-xl font-bold text-brand-700">{APP_NAME}</h1>
              <button onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            </div>
            <nav className="flex-1 py-2">
              {navItems.map((item) => <NavLink key={item.path} item={item} onClick={() => setSidebarOpen(false)} />)}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-white sticky top-0 z-30">
          <div className="h-14 flex items-center px-4 gap-3">
            <button className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div className="hidden md:block">
              <DayPicker compact />
            </div>
            <div className="flex-1" />
            <VoiceMicButton onClick={() => setVoiceOpen(true)} size="sm" className="shrink-0" />
            {cloudReady && (
              <Link
                to="/settings"
                title={statusMessage || 'Cloud sync'}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${
                  status === 'error' ? 'bg-red-50 text-red-700' :
                  status === 'syncing' ? 'bg-amber-50 text-amber-700' :
                  'bg-green-50 text-green-700'
                }`}
              >
                {status === 'syncing' ? <Loader2 size={14} className="animate-spin" /> :
                  status === 'error' ? <CloudOff size={14} /> : <Cloud size={14} />}
                {status === 'syncing' ? 'Saving…' : status === 'error' ? 'Sync issue' : 'Saved'}
              </Link>
            )}
            {!cloudReady && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-400 shrink-0" title="Redeploy app to enable cloud">
                <CloudOff size={14} /> Offline
              </span>
            )}
            <div className="flex-1 min-w-0 flex justify-end">
              <div className="flex items-center gap-2 px-2 text-xs text-gray-600 max-w-[160px]">
                <span
                  className="w-7 h-7 rounded-full text-white text-[10px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: user?.color }}
                >
                  {user?.name?.[0]}
                </span>
                <span className="truncate hidden sm:inline font-medium">{user?.name}</span>
              </div>
            </div>
            <button onClick={logout} className="lg:hidden p-2 text-gray-400 hover:text-red-500 shrink-0" title="Log out">
              <LogOut size={16} />
            </button>
          </div>
          <div className="md:hidden px-4 pb-3">
            <DayPicker compact className="justify-center" />
          </div>
          <InstallAppBanner />
        </header>
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6"><Outlet /></main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileBottomNav.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active ? 'text-brand-700' : 'text-gray-400'}`}>
                <Icon size={18} />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
          <VoiceMicButton onClick={() => setVoiceOpen(true)} size="sm" className="-mt-6 shrink-0" />
          <button
            onClick={() => setMobileAddOpen(!mobileAddOpen)}
            className="w-11 h-11 bg-accent-500 rounded-full flex items-center justify-center text-white shadow-lg -mt-6 shrink-0"
          >
            <Plus size={22} />
          </button>
          <Link to="/work" className={`flex flex-col items-center gap-0.5 px-2 py-1 ${location.pathname.startsWith('/work') ? 'text-brand-700' : 'text-gray-400'}`}>
            <Briefcase size={18} />
            <span className="text-[10px]">Work</span>
          </Link>
          <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center gap-0.5 px-2 py-1 text-gray-400">
            <Menu size={18} />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {mobileAddOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileAddOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 z-10">
            <h3 className="text-lg font-semibold mb-4">Quick add</h3>
            <button
              type="button"
              onClick={() => {
                setMobileAddOpen(false);
                setVoiceOpen(true);
              }}
              className="w-full flex items-center gap-3 p-4 mb-4 rounded-xl border-2 border-violet-200 bg-violet-50 text-violet-900 touch-manipulation"
            >
              <Mic size={22} className="text-violet-600 shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-sm">Voice add</p>
                <p className="text-xs text-violet-700">Say task, expense, or shopping</p>
              </div>
            </button>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Add task', path: '/tasks?add=true', icon: CheckSquare },
                { label: 'Log expense', path: '/expenses?add=true', icon: Receipt },
                { label: 'Split money', path: '/splits', icon: HandCoins },
                { label: 'Shopping list', path: '/daily?tab=shopping', icon: Sparkles },
                { label: 'Vision board', path: '/vision', icon: Star },
                { label: 'Work note', path: '/work?add=true', icon: Briefcase },
                { label: 'Home chore', path: '/home?add=true', icon: Home },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.path} to={action.path} onClick={() => setMobileAddOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50">
                    <Icon size={18} className="text-brand-600" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Link>
                );
              })}
            </div>
            <button onClick={() => setMobileAddOpen(false)} className="w-full mt-4 py-2.5 text-gray-500 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <VoiceAssistantSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  );
}
