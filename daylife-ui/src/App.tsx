import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { GitHubSyncProvider } from './features/sync/GitHubSyncContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MoneyPage } from './features/money/MoneyPage';
import { CommsPage } from './features/comms/CommsPage';
import { MorePage } from './features/more/MorePage';
import { LifeDashboardPage } from './features/life/LifeDashboardPage';
import { AiCalendarPage } from './features/calendar/AiCalendarPage';
import { VisionBoardPage } from './features/vision/VisionBoardPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ConnectionsPage } from './features/connections/ConnectionsPage';
import { ChatPage } from './features/chat/ChatPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './components/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { Toaster } from './components/Toaster';
import { AppUpdateBanner } from './components/AppUpdateBanner';
import { checkForNewerAppBuild } from './lib/appVersionCheck';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export default function App() {
  React.useEffect(() => {
    checkForNewerAppBuild();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GitHubSyncProvider>
        <AuthProvider>
          <BrowserRouter basename={routerBasename}>
          <AppUpdateBanner />
          <Toaster />
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              {/* Main tabs */}
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="money" element={<ErrorBoundary><MoneyPage /></ErrorBoundary>} />
              <Route path="comms" element={<ErrorBoundary><CommsPage /></ErrorBoundary>} />
              <Route path="more" element={<ErrorBoundary><MorePage /></ErrorBoundary>} />

              {/* Accessible from More */}
              <Route path="life" element={<ErrorBoundary><LifeDashboardPage /></ErrorBoundary>} />
              <Route path="vision" element={<ErrorBoundary><VisionBoardPage /></ErrorBoundary>} />
              <Route path="calendar" element={<ErrorBoundary><AiCalendarPage /></ErrorBoundary>} />
              <Route path="share" element={<ErrorBoundary><ConnectionsPage /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />

              {/* Direct chat thread links */}
              <Route path="chat/:spaceId" element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />

              {/* Legacy redirects */}
              <Route path="expenses" element={<Navigate to="/money" replace />} />
              <Route path="splits" element={<Navigate to="/money" replace />} />
              <Route path="reports" element={<Navigate to="/money" replace />} />
              <Route path="tasks" element={<Navigate to="/" replace />} />
              <Route path="daily" element={<Navigate to="/" replace />} />
              <Route path="chat" element={<Navigate to="/comms" replace />} />
              <Route path="mail" element={<Navigate to="/comms" replace />} />
              <Route path="home" element={<Navigate to="/" replace />} />
              <Route path="work" element={<Navigate to="/" replace />} />

              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
        </AuthProvider>
      </GitHubSyncProvider>
    </QueryClientProvider>
  );
}
