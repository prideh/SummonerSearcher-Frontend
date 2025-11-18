import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { usePasswordValidation } from '../components/usePasswordValidation';
import PasswordRequirements from '../components/PasswordRequirements';
import { validateResetToken, resetPassword } from '../api/auth';
import axios from 'axios';

const ResetPasswordForm: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTokenValidating, setIsTokenValidating] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (!resetToken) {
      navigate('/login');
      return;
    }

    const validateToken = async () => {
      try {
        await validateResetToken(resetToken);
        setToken(resetToken);
      } catch (error) {
        let message = 'Your password reset link is invalid or has expired.';
        if (axios.isAxiosError(error)) {
          message = error.response?.data?.message || error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        navigate('/login', { state: { error: message } });
      } finally {
        setIsTokenValidating(false);
      }
    };

    validateToken();
  }, [searchParams, navigate]);

  const { passwordRequirements, isPasswordValid } = usePasswordValidation(password);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) {
      setError('Cannot reset password without a valid token.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccessMessage('Your password has been reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Axios error (e.g., 4xx, 5xx response from server)
        setError(error.response?.data?.message || error.message);
      } else if (error instanceof Error) {
        // Generic JavaScript error
        setError(error.message);
      } else {
        // Unknown error type
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex items-start space-x-8">
        {isTokenValidating ? (
          <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-sm text-center">
            <h2 className="text-2xl font-bold mb-4 text-white">Verifying Token...</h2>
            <svg className="animate-spin h-8 w-8 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-sm">
              <h2 className="text-2xl font-bold mb-4 text-white">Reset Password</h2>
              {successMessage && <p className="text-green-500 text-sm italic mb-4">{successMessage}</p>}
              {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
              
              <div className="mb-4">
                <label htmlFor="password" className="block text-gray-400 text-sm font-bold mb-2">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-gray-300 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-16" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-bold text-gray-400 hover:text-blue-400 focus:outline-none">{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
    
              <div className="mb-6">
                <label htmlFor="confirm-password" className="block text-gray-400 text-sm font-bold mb-2">Confirm New Password</label>
                <input type={showPassword ? 'text' : 'password'} id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-gray-300 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500" required />
              </div>
    
              <div className="flex items-center justify-between">
                <button type="submit" disabled={isSubmitting || !token || !!successMessage} className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline flex items-center">
                  {isSubmitting && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
                <Link to="/login" className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800">Back to Login</Link>
              </div>
            </form>
            <PasswordRequirements requirements={passwordRequirements} />
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordForm;