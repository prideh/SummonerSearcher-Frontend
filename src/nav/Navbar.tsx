import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { updateDarkModePreference } from '../api/user';

/**
 * The main navigation bar for the application.
 * Redesigned with a professional glassmorphism aesthetic.
 */
const Navbar: React.FC = () => {
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const isDarkMode = useAuthStore((state) => state.darkMode);
  const setDarkMode = useAuthStore((state) => state.setDarkMode);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const [isOpen, setIsOpen] = useState(false); // Mobile menu state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // User dropdown state
  const location = useLocation();
  const navigate = useNavigate();

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Effect to apply the dark mode class to the root HTML element
  React.useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleThemeToggle = async () => {
    const newDarkModeState = !isDarkMode;
    setDarkMode(newDarkModeState);

    // Only update backend if logged in
    if (username) {
        try {
        await updateDarkModePreference(newDarkModeState);
        } catch (error) {
        if (import.meta.env.DEV) {
            console.error('Failed to update dark mode preference:', error);
        }
        console.error('Could not save theme preference.', error);
        setDarkMode(!newDarkModeState);
        }
    }
  };

  const isActive = (path: string) => location.pathname === path;



  // Main navigation links visible to everyone
  const navLinks = [
    { name: 'Search', path: '/search' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Status', path: '/status' },
    { name: 'Feedback', path: '/feedback' },
  ];

  // User-specific links (Dropdown / Mobile)
  const userLinks = [
    { name: 'Profile', path: '/profile' },
    { name: '2FA', path: '/2fa' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Brand + Desktop Navigation */}
          <div className="flex items-center space-x-8">
            <Link to="/search" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-800 border border-slate-700 dark:border-cyan-500/40 flex items-center justify-center p-1.5 shadow-xs">
                <img src="/lol.svg" alt="Summoner Searcher" className="w-full h-full object-contain" />
              </div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-cyan-400 transition-colors">
                Summoner Searcher
              </span>
            </Link>

            <div className="hidden md:flex items-baseline space-x-6">
              {navLinks.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`relative px-1.5 py-4 text-xs font-bold uppercase tracking-wider transition-colors duration-150 ${
                    isActive(item.path)
                      ? 'text-sky-600 dark:text-cyan-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.name}
                  {isActive(item.path) && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-sky-600 dark:bg-cyan-400" />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={handleThemeToggle}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111827] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-sky-500/50 dark:hover:border-cyan-400/50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <>
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm-.707 10.607a1 1 0 010-1.414l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Light Mode</span>
                </>
              )}
            </button>

            {/* User Profile / Logout / Login */}
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              {username ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-cyan-400 focus:outline-none px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111827]"
                  >
                    <span>{username}</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 focus:outline-none z-50">
                      {userLinks.map((item) => (
                         <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsDropdownOpen(false)}
                            className="block px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {item.name}
                          </Link>
                      ))}
                      <div className="border-t border-slate-200 dark:border-slate-800 my-1"></div>
                       <button
                        onClick={async () => {
                            await logout();
                            setIsDropdownOpen(false);
                            navigate('/search');
                        }}
                        className="block w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                        Logout
                        </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-950 bg-sky-600 hover:bg-sky-500 dark:bg-cyan-400 dark:hover:bg-cyan-300 rounded-md transition-colors shadow-xs"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`${isOpen ? 'block' : 'hidden'} md:hidden bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-b border-gray-200 dark:border-blue-900/30`}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navLinks.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive(item.path)
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {item.name}
            </Link>
          ))}
          {/* Mobile User Links */}
          {username && userLinks.map((item) => (
             <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive(item.path)
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {item.name}
            </Link>
          ))}

          <div className="pt-4 pb-2 border-t border-gray-200 dark:border-gray-700 mt-2">
            {username ? (
              <>
                <div className="flex items-center justify-between px-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {username}
                  </span>
                  <button
                    onClick={handleThemeToggle}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                   {isDarkMode ? (
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm-.707 10.607a1 1 0 010-1.414l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    setIsOpen(false);
                    navigate('/search');
                  }}
                  className="mt-3 w-full text-left px-3 py-2 text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="space-y-2 px-3">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Theme</span>
                    <button
                    onClick={handleThemeToggle}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                   {isDarkMode ? (
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm-.707 10.607a1 1 0 010-1.414l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                 </div>
                <button
                  onClick={() => {
                    openAuthModal('login');
                    setIsOpen(false);
                  }}
                  className="block w-full text-center px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    openAuthModal('register');
                    setIsOpen(false);
                  }}
                  className="block w-full text-center px-4 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
