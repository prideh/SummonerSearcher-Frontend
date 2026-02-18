import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from '../forms/LoginForm';
import RegistrationForm from '../forms/RegistrationForm';
import SearchPage from '../pages/SearchPage';
import ProtectedRoute from './ProtectedRoute';
import DashboardPage from '../pages/DashboardPage';
import StatusPage from '../pages/StatusPage';
import TwoFAPage from '../pages/TwoFAPage';
import RedirectIfLoggedIn from './RedirectIfLoggedIn';
import NotFoundPage from '../pages/NotFoundPage';
import ForgotPasswordForm from '../forms/ForgotPasswordForm';
import ResetPasswordForm from '../forms/ResetPasswordForm';
import ProfilePage from '../pages/ProfilePage';
import VerifyEmailPage from '../pages/VerifyEmailPage'; 
import TwoFAVerifyPage from '../pages/TwoFAVerifyPage'; 
import AdminDashboard from '../pages/AdminDashboard';

import PublicLayout from './PublicLayout';

/**
 * The central routing component for the application.
 * It defines all the application's routes and maps them to their respective page components.
 * It uses `ProtectedRoute` and `RedirectIfLoggedIn` to manage access to different parts of the app.
 */
const NavigationLayout: React.FC = () => {
  return (
    <Routes>
      <Route element={<RedirectIfLoggedIn />}>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/forgot-password" element={<ForgotPasswordForm />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} /> 
        <Route path="/login/2fa-verify" element={<TwoFAVerifyPage />} />
      </Route>
      
      {/* Public Routes with Navbar */}
      <Route element={<PublicLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/2fa" element={<TwoFAPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default NavigationLayout;