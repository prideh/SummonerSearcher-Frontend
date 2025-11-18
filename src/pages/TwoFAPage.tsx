import { useState } from 'react';
import { enable2FA, verify2FAEnable, disable2FA } from '../api/user';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setError(err.response?.data.message || 'Failed to enable 2FA. Please try again.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data || 'Verification failed. Please try again.');
      } else {
        setError('An unexpected error occurred during verification.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDisabling(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await disable2FA(parseInt(code, 10)); // Assuming 'code' state is used for disable as well
      setSuccessMessage(data.message || '2FA has been disabled successfully.');
      update2FAStatus(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data.message || 'Failed to disable 2FA.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-6 text-center">Two-Factor Authentication</h2>

      {error && <p className="text-red-500 text-center">{error}</p>}

      {successMessage && (
        <div className="bg-green-800 bg-opacity-50 border border-green-600 text-green-300 px-6 py-4 rounded-lg text-center max-w-md">
          <h3 className="font-bold text-xl mb-2">Success!</h3>
          <p>{successMessage}</p>
        </div>
      )}

      {!successMessage && (
        is2faEnabled ? (
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md">
            <p className="text-lg text-green-400 mb-4">2FA is currently enabled.</p>
            <p className="text-gray-400 mb-6">To disable it, please enter a code from your authenticator app.</p>
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
                className="p-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 text-center text-2xl tracking-widest w-48 focus:outline-none focus:ring-2 focus:ring-red-500"
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
                <p className="mb-4">Click the button below to start the 2FA setup process.</p>
                <button onClick={handleEnable2FA} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed">
                  Enable 2FA
                </button>
              </div>
            )}

            {loading && <p className="text-lg">Generating your QR code...</p>}

            {qrCode && !loading && (
              <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md">
                <p className="mb-4 text-gray-300">
                  Scan the QR code below with your authenticator app (like Google Authenticator, Authy, or 1Password).
                </p>
                <img src={qrCode} alt="2FA QR Code" className="mx-auto border-4 border-white rounded-lg" />
                <p className="mt-6 text-gray-400 text-sm mb-4">
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
                    className="p-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 text-center text-2xl tracking-widest w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
