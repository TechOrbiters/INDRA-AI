import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// tRPC client
import { trpc, createTRPCClient } from './lib/trpc';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';

// Page imports
import LandingPage from './pages/landing';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import ResetPasswordPage from './pages/reset-password';
import OnboardingLayout from './pages/onboarding/layout';
import Step1 from './pages/onboarding/step-1';
import Step2 from './pages/onboarding/step-2';
import Step3 from './pages/onboarding/step-3';
import Step4 from './pages/onboarding/step-4';
import Step5 from './pages/onboarding/step-5';
import DashboardPage from './pages/dashboard';
import SearchResultsPage from './pages/search-results';
import KnowledgeCreatePage from './pages/knowledge/create';
import KnowledgeViewPage from './pages/knowledge/view';
import KnowledgeEditPage from './pages/knowledge/edit';
import KnowledgeHealthPage from './pages/knowledge/health';
import CollectionsPage from './pages/collections';
import ExpertsPage from './pages/experts';
import MeetingsPage from './pages/meetings';
import GraphViewPage from './pages/graph-view';
import AdminPage from './pages/admin';

/**
 * Route guard — redirects unauthenticated users to /login.
 * Shows a loading spinner while auth state is rehydrating from localStorage.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading INDRA AI…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Onboarding wizard */}
      <Route path="/onboarding" element={<OnboardingLayout />}>
        <Route index element={<Navigate to="step-1" replace />} />
        <Route path="step-1" element={<Step1 />} />
        <Route path="step-2" element={<Step2 />} />
        <Route path="step-3" element={<Step3 />} />
        <Route path="step-4" element={<Step4 />} />
        <Route path="step-5" element={<Step5 />} />
      </Route>

      {/* Authenticated app */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchResultsPage /></ProtectedRoute>} />
      <Route path="/collections" element={<ProtectedRoute><CollectionsPage /></ProtectedRoute>} />
      <Route path="/experts" element={<ProtectedRoute><ExpertsPage /></ProtectedRoute>} />
      <Route path="/knowledge/health" element={<ProtectedRoute><KnowledgeHealthPage /></ProtectedRoute>} />
      <Route path="/knowledge/create" element={<ProtectedRoute><KnowledgeCreatePage /></ProtectedRoute>} />
      <Route path="/knowledge/:id" element={<ProtectedRoute><KnowledgeViewPage /></ProtectedRoute>} />
      <Route path="/knowledge/:id/edit" element={<ProtectedRoute><KnowledgeEditPage /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
      <Route path="/graph" element={<ProtectedRoute><GraphViewPage /></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: false },
        },
      })
  );

  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
