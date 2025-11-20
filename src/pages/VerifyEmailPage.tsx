import React, { useEffect, useState, useRef } from 'react'; // Import useRef
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { verifyEmail } from '../api/auth';

/**
 * A page that handles the email verification process.
 * It reads a token from the URL, sends it to the backend for validation,
 * and displays a success or error message to the user.
 */
const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string>('');
  const effectRan = useRef(false); // Flag to prevent useEffect from running twice in StrictMode development.

  useEffect(() => {
    /**
     * In development with React.StrictMode, this effect runs twice. This check ensures the API call is only made once.
     */
    if (effectRan.current === false && import.meta.env.DEV) {
      effectRan.current = true;
      return; // Skip the first run in StrictMode development
    }

    const controller = new AbortController(); // For cleanup
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check the link in your email.');
      return;
    }

    /**
     * Performs the asynchronous email verification API call.
     */
    const doVerification = async () => {
      try {
        // Pass the AbortController's signal to the API call to allow for cancellation.
        const response = await verifyEmail(token, controller.signal);
        const successMessage = response?.message || 'Your email has been successfully verified. You can now log in.';
        setStatus('success');
        setMessage(successMessage);
      } catch (error) {
        if (axios.isCancel(error)) { // Handle cancelled requests
          if (import.meta.env.DEV) {
            console.log('Verification request cancelled');
          }
          return;
        }
        setStatus('error');
        if (axios.isAxiosError(error)) {
          setMessage(error.response?.data?.message || 'Verification failed. The link may be invalid or expired.');
        } else if (error instanceof Error) {
          setMessage(error.message); // Display the specific error message thrown from api/auth.ts
        } else { // Fallback for any other unexpected error types
          setMessage('An unexpected error occurred during verification.');
        }
      }
    };

    doVerification();

    return () => {
      controller.abort(); // Cleanup: Abort the request if the component unmounts.
      effectRan.current = false; // Reset the flag for potential future remounts
    };
  }, [searchParams, navigate]); // `navigate` is used in setTimeout, so it should be in dependencies.

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md text-center">
        {status === 'verifying' && <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Verifying your email...</h2>}
        {status === 'success' && <h2 className="text-2xl font-bold text-green-500">Success!</h2>}
        {status === 'error' && <h2 className="text-2xl font-bold text-red-500">Verification Failed</h2>}
        <p className="text-gray-700 dark:text-gray-300 mt-4">{message}</p>
        {status !== 'verifying' && (
          <Link to="/login" className="mt-6 inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Go to Login</Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;