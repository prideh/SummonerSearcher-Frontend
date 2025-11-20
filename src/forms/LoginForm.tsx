import React, { useState, useEffect } from 'react';
import {  Link, useLocation, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
   
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
   
      window.history.replaceState({}, document.title);
    }
    // Display error message from password reset or other navigations
    if (location.state?.error) {
      setError(location.state.error);
      window.history.replaceState({}, document.title);
    }
  }, [location, navigate]);
  
  const fillDummyCredentials = () => {
    setEmail('dummy@summonersearcher.com');
    setPassword('Dummy123!');
  };

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
        login(data.jwt, email, data.twoFactorEnabled, data.darkmodePreference ?? true);
      } else if (data && data.twoFactorRequired && data.tempToken) {
        // 2FA is required, navigate to the verification page with the temp token
        navigate('/login/2fa-verify', { state: { tempToken: data.tempToken, email: email } });
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        // If the error has a response and a data object with a message, use it.
        // This is typical for 401 Unauthorized or 400 Bad Request from the backend.
        setError(err.response?.data?.message || err.response?.data || 'Invalid credentials or server error.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        // Unknown error type
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-950">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Login</h2>
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center font-semibold mb-2">
            Want to try it out? Use the dummy account:
          </p>
          <button
            type="button"
            onClick={fillDummyCredentials}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
          >
            Fill with Dummy Account
          </button>
        </div>
        <div className="text-center mb-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Or sign in with your email</p>
        </div>
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
            className="w-32 justify-center bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline flex items-center"
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
            <Link to="/forgot-password" className="font-bold text-cyan-400 hover:text-cyan-300">
              Forgot Password?
            </Link>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Don't have an account? <Link to="/register" className="font-bold text-cyan-400 hover:text-cyan-300">Sign Up</Link></p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;