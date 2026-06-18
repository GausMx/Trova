import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Payroll from './pages/Payroll';
import Compliance from './pages/Compliance';
import Billing from './pages/Billing';
import BillingCallback from './pages/BillingCallback';
import api from './utils/api';
import { LayoutDashboard, Users, CreditCard, ShieldCheck, LogOut, Briefcase, Receipt, Menu, X } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const accessToken = useAuthStore((state) => state.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Main Layout component (Sidebar + Header + Content)
const MainLayout = ({ children }) => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Background fetch latest user context on mount
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success && res.data?.data?.user) {
          useAuthStore.getState().setAuth(
            res.data.data.user,
            useAuthStore.getState().accessToken,
            useAuthStore.getState().refreshToken
          );
        }
      } catch (err) {
        console.error('Failed to fetch current user context', err);
      }
    };
    fetchMe();
  }, []);

  const company = user?.companyId;
  const companyId = company?._id;
  const subscriptionStatus = company?.subscriptionStatus;
  const trialEndsAt = company?.trialEndsAt;

  // Banner dismissal state
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (companyId) {
      const dismissed = localStorage.getItem(`dismissed-trial-expired-${companyId}`) === 'true';
      setIsDismissed(dismissed);
    }
  }, [companyId]);

  const handleDismiss = () => {
    if (companyId) {
      localStorage.setItem(`dismissed-trial-expired-${companyId}`, 'true');
      setIsDismissed(true);
    }
  };

  // Compute remaining trial days
  let daysRemaining = 0;
  let isTrialActive = false;
  let isTrialExpired = false;

  if (subscriptionStatus === 'trial' && trialEndsAt) {
    isTrialActive = true;
    const msDiff = new Date(trialEndsAt).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
  } else if (subscriptionStatus !== 'trial' && trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
    isTrialExpired = true;
  }

  const isSubscriptionActive = subscriptionStatus === 'active';
  const isLockedOut = !isTrialActive && !isSubscriptionActive;

  const renderBanner = () => {
    if (isTrialActive) {
      if (daysRemaining > 7) {
        return (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center space-x-3 shrink-0 shadow-sm transition-all duration-300">
            <span>Your free trial ends in <span className="font-bold">{daysRemaining}</span> days. Upgrade to Growth or Enterprise to keep advanced features.</span>
            <Link
              to="/billing"
              className="bg-white text-emerald-800 px-3 py-1 rounded-md text-xs font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
            >
              Upgrade Plan
            </Link>
          </div>
        );
      } else {
        return (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-center py-2.5 px-4 text-sm font-medium flex items-center justify-center space-x-3 shrink-0 shadow-sm transition-all duration-300">
            <span>⚠️ Your free trial ends in <span className="font-bold">{daysRemaining}</span> days. Upgrade your subscription now to avoid service interruption.</span>
            <Link
              to="/billing"
              className="bg-white text-amber-900 px-3 py-1 rounded-md text-xs font-semibold hover:bg-amber-50 transition-colors shadow-sm"
            >
              Upgrade Now
            </Link>
          </div>
        );
      }
    }

    if (isTrialExpired && !isDismissed) {
      return (
        <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white py-2.5 px-6 text-sm font-medium flex items-center justify-between shrink-0 shadow-sm transition-all duration-300">
          <div className="flex items-center space-x-3 mx-auto">
            <span>Your free trial has expired. You have been downgraded to the Starter tier. Upgrade to Growth or Enterprise to restore advanced features.</span>
            <Link
              to="/billing"
              className="bg-white text-rose-800 px-3 py-1 rounded-md text-xs font-semibold hover:bg-rose-50 transition-colors shadow-sm"
            >
              Upgrade Plan
            </Link>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return null;
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Employees', path: '/employees', icon: Users },
    { name: 'Payroll', path: '/payroll', icon: CreditCard },
    { name: 'Compliance', path: '/compliance', icon: ShieldCheck },
  ];

  if (['owner', 'admin'].includes(user?.role)) {
    navItems.push({ name: 'Billing', path: '/billing', icon: Receipt });
  }

  if (!user) return null;

  const isBillingRoute = location.pathname === '/billing' || location.pathname === '/billing/callback';

  if (isLockedOut && !isBillingRoute) {
    if (user?.role === 'owner') {
      return <Navigate to="/billing" replace />;
    } else {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-700 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Subscription Required</h3>
            <p className="text-slate-500 text-sm">
              Your company's free trial has expired and a subscription is required. Please ask the company owner to configure a billing plan.
            </p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {renderBanner()}
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar Drawer Backdrop for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-forest-900 text-white flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo Brand */}
          <div className="p-6 border-b border-forest-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white text-forest-900 rounded-lg flex items-center justify-center font-bold text-lg">
                T
              </div>
              <span className="text-xl font-bold tracking-wider">TROVA</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 text-forest-200 hover:text-white rounded-lg md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-forest-100 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-forest-800 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 rounded-full bg-forest-800 flex items-center justify-center font-semibold text-sm">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate leading-none mb-1">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-forest-200 capitalize truncate flex items-center space-x-1">
                <Briefcase className="w-3 h-3 inline" />
                <span>{user?.role}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-200 hover:bg-red-900/20 hover:text-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-slate-800 capitalize">
              {location.pathname.split('/')[1] || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs bg-forest-50 text-forest-700 px-3 py-1 rounded-full font-medium border border-forest-100">
              Corporate Account
            </span>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  </div>
);
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Main Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Employees />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Payroll />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compliance"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Compliance />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Billing />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/callback"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <BillingCallback />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all & Root Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
