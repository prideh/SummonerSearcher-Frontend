import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePasswordValidation } from '../components/usePasswordValidation';
import PasswordRequirements from '../components/PasswordRequirements';
import { registerUser } from '../api/auth';
import axios from 'axios';

/**
 * A form for new users to register for an account.
 * It validates password strength in real-time and ensures passwords match before submission.
 * On success, it navigates the user to the login page with a success message.
 */
const RegistrationForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { passwordRequirements, isPasswordValid } = usePasswordValidation(password);

  /**
   * Handles the form submission to register a new user.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser(email, password);
      // Registration successful, navigate to login page with a message prompting email verification.
      navigate('/login', { state: { message: 'Registration successful! Please verify your email to log in.' } });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (import.meta.env.DEV) {
          console.error('Registration failed:', error.message);
        }
        setError(error.response?.data || error.message);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center min-h-screen p-4 bg-gray-100 dark:bg-gray-950">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Register</h2>
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
        <div className="mb-4">
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
        <div className="mb-6">
          <label htmlFor="confirm-password" className="block text-gray-600 dark:text-gray-400 text-sm font-bold mb-2">Confirm Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="shadow appearance-none border border-gray-300 dark:border-gray-700 rounded w-full py-2 px-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 pr-16"
              required
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline flex items-center"
          >
            {isSubmitting && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
          <Link to="/login" className="inline-block align-baseline font-bold text-sm text-cyan-400 hover:text-cyan-300">
            Already have an account?
          </Link>
        </div>
      </form>
      
      <PasswordRequirements requirements={passwordRequirements} className="mt-8 md:mt-0 md:ml-8" />
    </div>

  );
};

export default RegistrationForm;