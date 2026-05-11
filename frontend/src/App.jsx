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
  const content = (
    <main className={withNav ? 'page-main' : undefined} style={withNav ? undefined : {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div className={withNav ? 'page-content' : undefined}>
        <div className="analytics-card state-block" style={{ minHeight: withNav ? '240px' : '180px' }}>
          <div className="state-pulse" />
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 800 }}>
            Loading BeeKeepr…
          </div>
        </div>
      </div>
    </main>
  );

  if (!withNav) return content;
  return (
    <div className="app-shell">
      <Navigation />
      {content}
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
