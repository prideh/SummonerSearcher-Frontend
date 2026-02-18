import React, { useState } from 'react';
import {  Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';

/**
 * The main login form for the application.
 * It handles user authentication, including the initial step of a 2FA login flow.
 * It also provides a button to pre-fill credentials for a dummy/demo account.
 */
interface LoginFormProps {
  onSuccess?: () => void;
  switchToRegister?: () => void;
  switchToForgotPassword?: () => void;
  initialMessage?: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, switchToRegister, switchToForgotPassword, initialMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(initialMessage || null);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null)
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return; 
    }
    setIsSubmitting(true);

    try {
      const data = await loginUser(email, password);
      if (data && data.jwt) {
        // Standard login success: store token and user data.
        login(data.jwt, email, data.twoFactorEnabled, data.darkmodePreference ?? true);
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      } else if (data && data.twoFactorRequired && data.tempToken) {
        // 2FA is required: navigate to the verification page with a temporary token.
        // For modal, we might need to handle this differently (e.g. switch modal view to 2FA), 
        // but for now let's keep the redirect as 2FA page is complex.
        navigate('/login/2fa-verify', { state: { tempToken: data.tempToken, email: email } });
        if (onSuccess) onSuccess(); // Close modal if we navigate away? Or keep it? 
        // Better to close modal if we navigate.
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (import.meta.env.DEV) {
          console.error("Login failed:", err.message);
        }
        setError(err.response?.data?.message || err.response?.data || 'Invalid credentials or server error.');        
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Login</h2>

        {successMessage && <p className="text-green-500 text-sm italic mb-4">{successMessage}</p>}
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-600 dark:text-gray-400 text-sm font-bold mb-2">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="shadow appearance-none border border-gray-300 dark:border-gray-700 rounded w-full py-2 px-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-600 dark:text-gray-400 text-sm font-bold mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border border-gray-300 dark:border-gray-700 rounded w-full py-2 px-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 pr-16"
              required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 focus:outline-none"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-40 justify-center bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline flex items-center"
          >
             {isSubmitting && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
          <div className="text-sm text-right">
            {switchToForgotPassword ? (
                <button
                    type="button"
                    onClick={switchToForgotPassword}
                    className="font-bold text-cyan-400 hover:text-cyan-300 focus:outline-none block ml-auto mb-1"
                >
                    Forgot Password?
                </button>
            ) : (
                <Link to="/forgot-password" className="font-bold text-cyan-400 hover:text-cyan-300 block mb-1">
                Forgot Password?
                </Link>
            )}
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Don't have an account?{' '}
              {switchToRegister ? (
                <button 
                  type="button" 
                  onClick={switchToRegister} 
                  className="font-bold text-cyan-400 hover:text-cyan-300 focus:outline-none"
                >
                  Sign Up
                </button>
              ) : (
                <Link to="/register" className="font-bold text-cyan-400 hover:text-cyan-300">
                  Sign Up
                </Link>
              )}
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;