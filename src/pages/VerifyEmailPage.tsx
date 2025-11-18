import React, { useEffect, useState, useRef } from 'react'; // Import useRef
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { verifyEmail } from '../api/auth';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string>('');
  const effectRan = useRef(false); // Flag to track if effect has run

  useEffect(() => {
    // In development, StrictMode mounts, unmounts, and remounts components.
    // This causes useEffect to run twice. We want our API call to run only once.
    // This flag ensures the API call is made only on the "real" mount.
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

    const doVerification = async () => {
      try {
        // Pass the signal to the API call
        const response = await verifyEmail(token, controller.signal);
        const successMessage = response?.message || 'Your email has been successfully verified. You can now log in.';
        setStatus('success');
        setMessage(successMessage);
      } catch (error) {
        if (axios.isCancel(error)) { // Handle cancelled requests
          console.log('Verification request cancelled');
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
      controller.abort(); // Abort the request if the component unmounts or the effect re-runs
      effectRan.current = false; // Reset the flag for potential future remounts
    };
  }, [searchParams, navigate]); // `navigate` is used in setTimeout, so it should be in dependencies.

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md text-center">
        {status === 'verifying' && <h2 className="text-2xl font-bold text-white">Verifying your email...</h2>}
        {status === 'success' && <h2 className="text-2xl font-bold text-green-500">Success!</h2>}
        {status === 'error' && <h2 className="text-2xl font-bold text-red-500">Verification Failed</h2>}
        <p className="text-gray-300 mt-4">{message}</p>
        {status !== 'verifying' && (
          <Link to="/login" className="mt-6 inline-block bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Go to Login</Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;