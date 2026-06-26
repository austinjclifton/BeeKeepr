import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme/theme";
import HealthCheck from './pages/HealthCheck';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));

function RouteLoading({ withNav = false }) {
  if (!withNav) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="w-full max-w-content px-7">
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-surface-elevated p-6 text-center text-sm text-ink-secondary shadow-card-sm">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber" />
            <div className="text-[14px] font-extrabold text-ink-secondary">
              Loading BeeKeepr…
            </div>
          </div>
        </div>
      </main>
    );
  }
  return (
    <div className="app-shell flex min-h-screen">
      <Navigation />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto w-full max-w-content px-7 py-7">
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-surface-elevated p-6 text-center text-sm text-ink-secondary shadow-card-sm">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber" />
            <div className="text-[14px] font-extrabold text-ink-secondary">
              Loading BeeKeepr…
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function lazyPublic(element) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function lazyProtected(element) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteLoading withNav />}>{element}</Suspense>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* Public pages */}
          <Route path="/health" element={<HealthCheck />} />
          <Route path="/" element={lazyPublic(<LoginPage />)} />
          <Route path="/signup" element={lazyPublic(<SignUpPage />)} />
          <Route path="/reset-password" element={lazyPublic(<ResetPasswordPage />)} />

          {/* Auth-gated pages */}
          <Route path="/dashboard" element={lazyProtected(<Dashboard />)} />
          <Route path="/analytics" element={lazyProtected(<Analytics />)} />
          <Route path="/alerts" element={lazyProtected(<Alerts />)} />
          <Route path="/settings" element={lazyProtected(<Settings />)} />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
