import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuthStore } from '../store/authStore';

/**
 * A route guard component.
 * If the user is logged in (checked via the `useAuthStore`), it renders the nested routes
 * (children) within a layout that includes the `Navbar`.
 * If the user is not logged in, it redirects them to the `/login` page.
 */
const ProtectedRoute: React.FC = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  return isLoggedIn ? (
    <>
      <Navbar />
      <Outlet />
    </>
  ) : <Navigate to="/login"/>;
};

export default ProtectedRoute;
