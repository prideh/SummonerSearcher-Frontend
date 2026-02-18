import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import LoginForm from '../forms/LoginForm';
import RegistrationForm from '../forms/RegistrationForm';
import { useLocation } from 'react-router-dom';
import ForgotPasswordForm from '../forms/ForgotPasswordForm';

/**
 * A modal that contains the Login and Registration forms.
 * Allows users to authenticate without leaving the current page.
 */
const AuthModal: React.FC = () => {
  const isOpen = useAuthStore((state) => state.authModalOpen);
  const view = useAuthStore((state) => state.authView);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const location = useLocation();

  const [loginMessage, setLoginMessage] = React.useState<string | null>(null);

  // Close modal when location changes (e.g. successful login redirect if any, or navigation)
  useEffect(() => {
    // If we want the modal to persist across some navigations, we might not want this.
    // But generally closing on nav is safe.
    // actually, if login redirects to dashboard, we definitely want it closed.
    // But if we just switch tabs using client-side routing, maybe not?
    // Let's rely on explicit close for now, or successful login.
    setLoginMessage(null); // Clear message on navigation
  }, [location, isOpen]); // Also clear when modal opens/closes

  if (!isOpen) return null;

  // Determine max-width based on view
  const maxWidthClass = view === 'register' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className={`bg-white dark:bg-gray-900 w-full ${maxWidthClass} rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 relative transition-all duration-300 ease-in-out`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors z-10"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-1">
          {view === 'login' ? (
            <LoginForm 
              onSuccess={closeAuthModal}
              switchToRegister={() => { setLoginMessage(null); openAuthModal('register'); }}
              switchToForgotPassword={() => { setLoginMessage(null); openAuthModal('forgot-password'); }}
              initialMessage={loginMessage}
            />
          ) : view === 'register' ? (
            <RegistrationForm 
              onSuccess={() => {
                 setLoginMessage("Registration successful! Please verify your email to log in.");
                 openAuthModal('login');
              }}
              switchToLogin={() => { setLoginMessage(null); openAuthModal('login'); }}
            />
          ) : (
            <ForgotPasswordForm
              switchToLogin={() => openAuthModal('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
