import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

/**
 * A layout component for public pages that includes the Navbar.
 * This ensures that the Navbar is visible on pages like Dashboard, Search, and Status,
 * regardless of the user's login status.
 */
const PublicLayout: React.FC = () => {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
};

export default PublicLayout;
