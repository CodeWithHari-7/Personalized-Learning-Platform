import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import Courses from './pages/Courses';
import Recommendations from './pages/Recommendations';
import Progress from './pages/Progress';
import LearningPath from './pages/LearningPath';
import AITutor from './pages/AITutor';
import Quiz from './pages/Quiz';
import CodingChallenges from './pages/CodingChallenges';
import CareerRecommendation from './pages/CareerRecommendation';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

// 404 page
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-9xl font-black gradient-text mb-4">404</div>
      <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
      <p className="text-slate-400 mb-8">The page you're looking for doesn't exist.</p>
      <a href="/dashboard" className="btn-primary px-6 py-3">Go to Dashboard</a>
    </div>
  );
}

// Protected route
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Public route (redirect if logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/learning-path" element={<LearningPath />} />
        <Route path="/ai-tutor" element={<AITutor />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/coding" element={<CodingChallenges />} />
        <Route path="/career" element={<CareerRecommendation />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: 'rgba(26, 26, 46, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#e2e8f0',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#22c55e', secondary: '#e2e8f0' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#e2e8f0' },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
