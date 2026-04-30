

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Public pages
import Landing  from './pages/Landing';
import Register from './pages/Register';
import Login    from './pages/Login';

// App layout wrapper
import AppLayout from './components/AppLayout';

// Authenticated app pages
import Dashboard          from './pages/app/Dashboard';
import Profile            from './pages/app/Profile';
import Analytics          from './pages/app/Analytics';
import MyFiles            from './pages/app/MyFiles';
import UploadFile         from './pages/app/UploadFile';
import Providers          from './pages/app/Providers';
import Marketplace        from './pages/app/Marketplace';
import Withdraw           from './pages/app/Withdraw';
import ProviderInstructions from './pages/app/ProviderInstructions';
import MyStorageNode      from './pages/app/MyStorageNode';
import AbuseReport        from './pages/app/AbuseReport';
import UninstallGuide    from './pages/app/UninstallGuide';
import Plans             from './pages/app/Plans';
import PlansPayment      from './pages/app/PlansPayment';

// Public shared file page
import SharedFile from './pages/app/SharedFile';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';

function AppRoute({ element }) {
  return <AppLayout>{element}</AppLayout>;
}

function AdminRoute({ element }) {
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  if (!user || user.role !== 'admin') return <Navigate to="/app/dashboard" replace />;
  return element;
}

function ProviderOnlyRoute({ element }) {
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'provider' && user.role !== 'admin') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return element;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/"          element={<Landing />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/login"     element={<Login />} />

        {/* Legacy redirect */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />

        {/* Authenticated app routes */}
        <Route path="/app/dashboard"  element={<AppRoute element={<Dashboard />} />} />
        <Route path="/app/profile"    element={<AppRoute element={<Profile />} />} />
        <Route path="/app/analytics"  element={<AppRoute element={<Analytics />} />} />
        <Route path="/app/files"      element={<AppRoute element={<MyFiles />} />} />
        <Route path="/app/upload"     element={<AppRoute element={<UploadFile />} />} />
        <Route path="/app/providers"  element={<ProviderOnlyRoute element={<AppRoute element={<Providers />} />} />} />
        <Route path="/app/marketplace" element={<AppRoute element={<Marketplace />} />} />
        <Route path="/app/withdraw"   element={<AppRoute element={<Withdraw />} />} />
        <Route path="/app/setup"      element={<AppRoute element={<ProviderInstructions />} />} />
        <Route path="/app/node"       element={<AppRoute element={<MyStorageNode />} />} />
        <Route path="/app/abuse"      element={<AppRoute element={<AbuseReport />} />} />
        <Route path="/app/uninstall"  element={<AppRoute element={<UninstallGuide />} />} />
        <Route path="/app/plans"      element={<AppRoute element={<Plans />} />} />
        <Route path="/app/plans/payment" element={<AppRoute element={<PlansPayment />} />} />

        {/* Admin — protected by role guard, wrapped in AppLayout */}
        <Route path="/admin" element={<AdminRoute element={<AppRoute element={<AdminDashboard />} />} />} />

        {/* Public shared file — no auth required */}
        <Route path="/share/:shareToken" element={<SharedFile />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
