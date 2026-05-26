import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/AuthContext';
import { useGitHubSync } from '../../features/sync/GitHubSyncContext';
import { api, User, ApiError } from '../../lib/api';
import { DayPicker } from '../DayPicker';
import { InstallAppBanner } from '../InstallAppBanner';
import { PinModal } from '../PinModal';
import { toast } from '../Toaster';
import {
  LayoutDashboard, CheckSquare, Receipt, Briefcase, Home, Settings,
  Menu, X, Plus, LogOut, Heart, BarChart3, Sparkles, Cloud, CloudOff, Loader2, Star, HandCoins, Users,
} from 'lucide-react';
import { supportsExpenseSplits } from '../../lib/household';

const baseNavItems = [
  { path: '/', label: 'My day', icon: LayoutDashboard, multiLabel: 'My day' },
  { path: '/tasks', label: 'All tasks', icon: CheckSquare },
  { path: '/daily', label: 'Daily life', icon: Sparkles },
  { path: '/vision', label: 'Vision board', icon: Star },
  { path: '/expenses', label: 'Expenses', icon: Receipt },
  { path: '/splits', label: 'Split money', icon: HandCoins, splitOnly: true },
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
  const { user, members, switchUser, logout } = useAuth();
  const { status, statusMessage, cloudReady } = useGitHubSync();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [switchPinOpen, setSwitchPinOpen] = useState(false);
  const [switchError, setSwitchError] = useState('');

  const { data: allMembers = members } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
    initialData: members,
  });

  const navItems = baseNavItems.filter(
    (item) => !item.splitOnly || supportsExpenseSplits(allMembers.length),
  );

  const startSwitch = (memberId: string) => {
    if (memberId === user?.id) {
      setSwitchOpen(false);
      return;
    }
    const target = allMembers.find((m) => m.id === memberId);
    setPendingSwitchId(memberId);
    setSwitchOpen(false);
    setSwitchError('');
    if (target?.hasPin) {
      setSwitchPinOpen(true);
    } else {
      switchUser(memberId).catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not switch account');
      });
      setPendingSwitchId(null);
    }
  };

  const completeSwitchWithPin = async (pin: string) => {
    if (!pendingSwitchId) return;
    try {
      await switchUser(pendingSwitchId, pin);
      setSwitchPinOpen(false);
      setPendingSwitchId(null);
    } catch (err: any) {
      setSwitchError(err instanceof ApiError ? err.message : 'Wrong PIN');
      throw err;
    }
  };

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
              <h1 className="text-lg font-bold text-brand-700">DayLife</h1>
              <p className="text-xs text-gray-400">Daily planner</p>
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
              <h1 className="text-xl font-bold text-brand-700">DayLife</h1>
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
              {allMembers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setSwitchOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200 max-w-[180px]"
                  title="Switch account"
                >
                  <span
                    className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: user?.color }}
                  >
                    {user?.name?.[0]}
                  </span>
                  <span className="truncate hidden sm:inline">{user?.name}</span>
                  <Users size={14} className="shrink-0 text-gray-400" />
                </button>
              ) : (
                <div className="flex items-center gap-2 px-2 text-xs text-gray-500">
                  <span
                    className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center"
                    style={{ backgroundColor: user?.color }}
                  >
                    {user?.name?.[0]}
                  </span>
                  <span className="hidden sm:inline">{user?.name}</span>
                </div>
              )}
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
          <button
            onClick={() => setMobileAddOpen(!mobileAddOpen)}
            className="w-11 h-11 bg-accent-500 rounded-full flex items-center justify-center text-white shadow-lg -mt-6"
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

      {switchOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSwitchOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl z-10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Switch account</h2>
              <button type="button" onClick={() => setSwitchOpen(false)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Choose who is using DayLife on this device.</p>
            <div className="space-y-2">
              {allMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => startSwitch(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
                    m.id === user?.id ? 'border-brand-300 bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="w-9 h-9 rounded-full text-white text-sm flex items-center justify-center shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.name[0]}
                  </span>
                  <span className="font-medium flex-1">{m.name}</span>
                  {m.hasPin && <span className="text-xs text-gray-400">PIN</span>}
                  {m.id === user?.id && <span className="text-xs text-brand-600">Active</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {switchPinOpen && pendingSwitchId && (
        <PinModal
          title="Enter PIN"
          subtitle={allMembers.find((m) => m.id === pendingSwitchId)?.name}
          submitLabel="Switch"
          onClose={() => {
            setSwitchPinOpen(false);
            setPendingSwitchId(null);
            setSwitchError('');
          }}
          onSubmit={completeSwitchWithPin}
          error={switchError}
        />
      )}
    </div>
  );
}
