import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verify2FALogin } from '../api/auth';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const TwoFAVerifyPage: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Retrieve the temp token and email from the navigation state
  const { tempToken, email } = location.state || {};

  if (!tempToken || !email) {
    // If state is missing, redirect back to login
    navigate('/login', { state: { error: 'An error occurred. Please try logging in again.' } });
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await verify2FALogin(tempToken, code);
      if (data && data.jwt) {
        // On successful verification, complete the login process
        console.log(data)
        login(data.jwt, email, data.twoFactorRequired);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Invalid 2FA code.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-white">Two-Factor Authentication</h2>
        <p className="text-gray-400 mb-4">Enter the 6-digit code from your authenticator app.</p>
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        <div className="mb-4">
          <label htmlFor="2fa-code" className="block text-gray-400 text-sm font-bold mb-2">Verification Code</label>
          <input
            type="tel"
            id="2fa-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={6}
            className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-gray-300 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 text-center text-2xl tracking-widest"
            required
          />
        </div>
        <div className="flex items-center justify-center">
          <button type="submit" disabled={isSubmitting} className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline">
            {isSubmitting ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TwoFAVerifyPage;
