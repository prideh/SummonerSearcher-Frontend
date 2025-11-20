import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import axios from 'axios';

/**
 * A form for users who have forgotten their password.
 * It takes an email address and sends a request to the backend to initiate the password reset process.
 */
const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handles the form submission to request a password reset link.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email);
      setSuccessMessage(response || 'Done!');

    } catch (error) {
      if (axios.isAxiosError(error)) {
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-950">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Forgot Password</h2>
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
        <div className="flex items-center justify-between mb-4">
          <button type="submit" disabled={isSubmitting} className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline">
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </div>
        <div className="text-center">
          <Link to="/login" className="inline-block align-baseline font-bold text-sm text-cyan-400 hover:text-cyan-300">
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordForm;