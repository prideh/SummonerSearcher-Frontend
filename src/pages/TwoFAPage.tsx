import { useState, useEffect } from 'react';
import { enable2FA, verify2FAEnable, disable2FA } from '../api/user';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * The TwoFAPage allows users to enable or disable Two-Factor Authentication for their account.
 * It guides the user through scanning a QR code and verifying with a code from their authenticator app.
 */
const TwoFAPage = () => {
  const is2faEnabled = useAuthStore((state) => state.is2faEnabled);
  const update2FAStatus = useAuthStore((state) => state.update2FAStatus);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Effect to synchronize the component's local state with the global auth state.
   * If the global `is2faEnabled` status changes (e.g., on login), this resets the local
   * state to ensure the correct view (enable vs. disable) is shown and clears old data.
   */
  useEffect(() => {
    // Reset local state when the global 2FA status changes
    setQrCode(null);
    setTwoFaSecret(null);
    setCode('');
    setError(null);
    setSuccessMessage(null);
    setCopied(false);
  }, [is2faEnabled]);

  /**
   * Initiates the 2FA setup process by fetching a QR code and secret from the backend.
   */
  const handleEnable2FA = async () => {
    setLoading(true);
    setError(null);
    setQrCode(null);

    try {
      const data = await enable2FA();
      setQrCode(data.qrCodeDataUri);
      setTwoFaSecret(data.secret);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (import.meta.env.DEV) {
          console.error('Failed to enable 2FA:', err.message);
        }
        setError(err.response?.data || 'Failed to enable 2FA. Please try again.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles the form submission to verify the 2FA code and finalize the enabling process.
   */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaSecret || code.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsVerifying(true);
    setError(null);

    try {
      const data = await verify2FAEnable(twoFaSecret, parseInt(code, 10));
      setSuccessMessage(data.message || '2FA has been enabled successfully.');
      update2FAStatus(true);
      setQrCode(null); // Hide the QR/verification form on success
      setCode(''); // Clear the code input on success
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (import.meta.env.DEV) {
          console.error('2FA verification failed:', err.message);
        }
        setError(err.response?.data || 'Verification failed. Please try again.');
      } else {
        setError('An unexpected error occurred during verification.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Handles the form submission to disable 2FA, requiring a final code for confirmation.
   */
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDisabling(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await disable2FA(parseInt(code, 10)); // Assuming 'code' state is used for disable as well
      setSuccessMessage(data.message || '2FA has been disabled successfully.');
      update2FAStatus(false);
      setCode(''); // Clear the code input on success
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (import.meta.env.DEV) {
          console.error('Failed to disable 2FA:', err.message);
        }
        setError(err.response?.data.message || 'Failed to disable 2FA.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsDisabling(false);
    }
  };

  /**
   * Copies the 2FA secret key to the clipboard for manual entry in authenticator apps.
   */
  const handleCopySecret = () => {
    if (twoFaSecret) {
      navigator.clipboard.writeText(twoFaSecret);
      setCopied(true);
      // Reset the copied state after a few seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-6 text-center">Two-Factor Authentication</h2>

      {error && <p className="text-red-500 text-center">{error}</p>}

      {successMessage && (
        <div className="bg-green-800 bg-opacity-50 border border-green-600 text-green-300 px-6 py-4 rounded-lg text-center w-full max-w-md">
          <h3 className="font-bold text-xl mb-2">Success!</h3>
          <p>{successMessage}</p>
        </div>
      )}

      {!successMessage && (
        is2faEnabled ? (
          <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-lg shadow-lg text-center w-full max-w-md">
            <p className="text-lg text-green-400 mb-4">2FA is currently enabled.</p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">To disable it, please enter a code from your authenticator app.</p>
            <form onSubmit={handleDisable2FA} className="flex flex-col items-center">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  if (value.length <= 6) setCode(value);
                }}
                placeholder="6-digit code"
                maxLength={6}
                className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-center text-2xl tracking-widest w-full max-w-[12rem] focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <button
                type="submit"
                disabled={isDisabling || code.length !== 6}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-400 disabled:cursor-not-allowed">
                {isDisabling ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {!qrCode && !loading && (
              <div className="text-center">
                <p className="mb-4 text-gray-600 dark:text-gray-300">Click the button below to start the 2FA setup process.</p>
                <button onClick={handleEnable2FA} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-cyan-400 disabled:cursor-not-allowed">
                  Enable 2FA
                </button>
              </div>
            )}

            {loading && <p className="text-lg">Generating your QR code...</p>}

            {qrCode && !loading && (
              <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-lg shadow-lg text-center w-full max-w-md">
                {/* Mobile View: Text Secret */}
                <div className="md:hidden">
                  <p className="mb-4 text-gray-600 dark:text-gray-300">
                    Open your authenticator app and enter the setup key below.
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex items-center justify-between space-x-4">
                    <span className="text-lg font-mono text-gray-200 break-all text-left">{twoFaSecret}</span>
                    <button
                      onClick={handleCopySecret}
                      type="button"
                      className={`text-sm font-semibold py-2 px-3 rounded-md shrink-0 transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Desktop View: QR Code */}
                <div className="hidden md:block">
                  <p className="mb-4 text-gray-600 dark:text-gray-300">
                    Scan the QR code below with your authenticator app (like Google Authenticator, Authy, or 1Password).
                  </p>
                  <img src={qrCode} alt="2FA QR Code" className="mx-auto border-4 border-white rounded-lg" />
                </div>

                <p className="mt-6 text-gray-500 dark:text-gray-400 text-sm mb-4">
                  After scanning, enter the 6-digit code from your app to verify.
                </p>
                <form onSubmit={handleVerifyCode} className="flex flex-col items-center">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={code}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length <= 6) setCode(value);
                    }}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-center text-2xl tracking-widest w-full max-w-[12rem] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button type="submit" disabled={isVerifying} className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-not-allowed">
                    {isVerifying ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </form>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};

export default TwoFAPage;
