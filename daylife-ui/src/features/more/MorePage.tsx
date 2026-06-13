import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useConnections } from '../../hooks/useConnections';
import { useChatUnreadCount } from '../../hooks/useChatUnread';
import {
  Star, Calendar, Users, Settings, LogOut,
  ChevronRight, Shield, Brain, Lightbulb,
} from 'lucide-react';

const menuItems = [
  { path: '/life', label: 'Life Dashboard', hint: 'AI scores, patterns, predictions', icon: Brain, color: 'text-violet-600 bg-violet-50' },
  { path: '/memory', label: 'AI Memory', hint: 'Promises, ideas, everything Rozka remembers', icon: Lightbulb, color: 'text-indigo-600 bg-indigo-50' },
  { path: '/vision', label: 'Dreams & Goals', hint: 'AI future plan', icon: Star, color: 'text-amber-600 bg-amber-50' },
  { path: '/calendar', label: 'AI Calendar', hint: 'Month view + AI week plan', icon: Calendar, color: 'text-blue-600 bg-blue-50' },
  { path: '/share', label: 'Share & Connect', hint: 'Invite people, manage sharing', icon: Users, color: 'text-violet-600 bg-violet-50' },
  { path: '/settings', label: 'Settings', hint: 'Profile, sync, data, notifications', icon: Settings, color: 'text-gray-600 bg-gray-100' },
  { path: '/privacy', label: 'Privacy Policy', hint: '', icon: Shield, color: 'text-gray-400 bg-gray-50' },
] as const;

export function MorePage() {
  const { user, logout } = useAuth();
  const { data: connections = [] } = useConnections();
  const pendingCount = connections.filter((c) => c.status === 'pending_received').length;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Profile card */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
          style={{ backgroundColor: user?.color }}
        >
          {user?.name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{user?.name}</p>
          {user?.username && <p className="text-xs text-gray-400">@{user.username}</p>}
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const badge = item.path === '/share' && pendingCount > 0 ? pendingCount : 0;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                {item.hint && <p className="text-xs text-gray-400">{item.hint}</p>}
              </div>
              {badge > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-red-500 font-medium"
      >
        <LogOut size={16} /> Log out
      </button>
    </div>
  );
}
