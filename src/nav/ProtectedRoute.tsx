import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute: React.FC = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  return isLoggedIn ? (
    <>
      <Navbar />
      <Outlet />
    </>
  ) : <Navigate to="/login" state={{ message: 'Your session has expired.' }} />;
};

export default ProtectedRoute;
