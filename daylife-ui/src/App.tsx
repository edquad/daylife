import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { GitHubSyncProvider } from './features/sync/GitHubSyncContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TasksPage } from './features/tasks/TasksPage';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { ExpenseReportsPage } from './features/expenses/ExpenseReportsPage';
import { SplitBalancesPage } from './features/expenses/SplitBalancesPage';
import { DailyLifePage } from './features/daily/DailyLifePage';
import { VisionBoardPage } from './features/vision/VisionBoardPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ConnectionsPage } from './features/connections/ConnectionsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './components/NotFoundPage';
import { Toaster } from './components/Toaster';
import { AppUpdateBanner } from './components/AppUpdateBanner';

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

function AreaRedirect({ area }: { area: 'HOME' | 'WORK' }) {
  return <Navigate to={`/tasks?area=${area}&status=TODO`} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GitHubSyncProvider>
        <AuthProvider>
          <BrowserRouter basename={routerBasename}>
          <AppUpdateBanner />
          <Toaster />
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="tasks" element={<ErrorBoundary><TasksPage /></ErrorBoundary>} />
              <Route path="expenses" element={<ErrorBoundary><ExpensesPage /></ErrorBoundary>} />
              <Route path="splits" element={<ErrorBoundary><SplitBalancesPage /></ErrorBoundary>} />
              <Route path="reports" element={<ErrorBoundary><ExpenseReportsPage /></ErrorBoundary>} />
              <Route path="daily" element={<ErrorBoundary><DailyLifePage /></ErrorBoundary>} />
              <Route path="vision" element={<ErrorBoundary><VisionBoardPage /></ErrorBoundary>} />
              <Route path="work" element={<AreaRedirect area="WORK" />} />
              <Route path="home" element={<AreaRedirect area="HOME" />} />
              <Route path="share" element={<ErrorBoundary><ConnectionsPage /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
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
