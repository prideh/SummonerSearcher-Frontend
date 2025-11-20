import React, { useState } from 'react';
import { usePasswordValidation } from '../components/usePasswordValidation';
import PasswordRequirements from '../components/PasswordRequirements';
import { changePassword } from '../api/user';
import axios from 'axios';

const ChangePasswordForm = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { passwordRequirements, isPasswordValid } = usePasswordValidation(newPassword);
  const [showOldPassword, setShowOldPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!isPasswordValid) {
      setError('New password does not meet all requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (oldPassword === newPassword) {
      setError('New passwords needs to be different.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccessMessage('Your password has been changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => closeModal(), 3000); // Close modal after 3 seconds
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

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    // Reset form state when closing the modal
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-md w-full max-w-sm">
      <h3 className="text-xl font-bold mb-4 text-gray-100">Security</h3>
      <p className="text-gray-400 mb-4">Update your password for enhanced security.</p>
      <button onClick={openModal} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded focus:shadow-outline">
        Change Password
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col md:flex-row items-start md:space-x-8">
            <form onSubmit={handleSubmit}>
              <h2 className="text-2xl font-bold mb-4 text-gray-100">Change Your Password</h2>
              {successMessage && <p className="text-green-500 text-sm italic mb-4">{successMessage}</p>}
              {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}

              <div className="mb-4">
                <label htmlFor="current-password" className="block text-gray-400 text-sm font-bold mb-2">Current Password</label>
                <div className="relative">
                  <input type={showOldPassword ? 'text' : 'password'} id="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="shadow appearance-none border border-gray-700 rounded w-full py-2 px-3 bg-gray-800 text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 pr-16" required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} tabIndex={-1} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-bold text-gray-400 hover:text-cyan-400 focus:outline-none">{showOldPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="new-password" className="block text-gray-400 text-sm font-bold mb-2">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="shadow appearance-none border border-gray-700 rounded w-full py-2 px-3 bg-gray-800 text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 pr-16" required autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-bold text-gray-400 hover:text-cyan-400 focus:outline-none">{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="confirm-new-password" className="block text-gray-400 text-sm font-bold mb-2">Confirm New Password</label>
                <input type={showPassword ? 'text' : 'password'} id="confirm-new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="shadow appearance-none border border-gray-700 rounded w-full py-2 px-3 bg-gray-800 text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" required autoComplete="new-password" />
              </div>

              <div className="flex items-center justify-end space-x-4">
                <button type="button" onClick={closeModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:shadow-outline">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline flex items-center">
                  {isSubmitting && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
            <PasswordRequirements requirements={passwordRequirements} className="mt-6 md:mt-0" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangePasswordForm;