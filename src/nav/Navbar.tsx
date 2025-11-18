import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const Navbar: React.FC = () => {
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);

  return (
    <nav className="bg-gray-800 p-4">
      <ul className="flex justify-between items-center">
        <div className="flex space-x-4">
          <li>
            <Link to="/dashboard" className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
          </li>
          <li>
            <Link to="/search" className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Search</Link>
          </li>
          <li>
            <Link to="/status" className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Status</Link>
          </li>
          <li>
            <Link to="/profile" className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Profile</Link>
          </li>
          <li>
            <Link to="/2fa" className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">2FA</Link>
          </li>
        </div>
        <div>
          <div className="flex items-center space-x-4">
            {username && <span className="text-gray-300 text-sm">Hello, {username}!</span>}
            <button onClick={logout} className="text-white hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Logout</button>
          </div>
        </div>
      </ul>
    </nav>
  );
};

export default Navbar;
