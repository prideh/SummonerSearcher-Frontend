import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUser } from '../api/user';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * A form component, presented within a modal, for users to permanently delete their account.
 * It requires password confirmation for this destructive action.
 * On success, it logs the user out and redirects them.
 */
const DeleteAccountForm = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  /**
   * Handles the form submission to delete the user's account.
   */
  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await deleteUser(password);
      // On successful deletion, call the logout action from the auth store and navigate away.
      logout();
      navigate('/login', { replace: true, state: { message: 'Your account has been successfully deleted.' } });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(error.response?.data || 'Failed to delete account. Please check your password.');
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred.');
      }
      setIsSubmitting(false);
    }
  };

  const openModal = () => setIsModalOpen(true);
  // Resets the form state when the modal is closed.
  const closeModal = () => {
    setIsModalOpen(false);
    setPassword('');
    setError(null);
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md w-full max-w-sm mt-8">
      <h3 className="text-xl font-bold mb-4 text-red-500">Danger Zone</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Deleting your account is permanent and cannot be undone.</p>
      <button onClick={openModal} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded focus:shadow-outline">
        Delete My Account
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Are you sure?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">This action is irreversible. To confirm, please enter your password.</p>
            <form onSubmit={handleDelete}>
              {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
              <div className="mb-6">
                <label htmlFor="delete-password" className="block text-gray-600 dark:text-gray-400 text-sm font-bold mb-2">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} id="delete-password" value={password} onChange={(e) => setPassword(e.target.value)} className="shadow appearance-none border border-gray-300 dark:border-gray-700 rounded w-full py-2 px-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-16" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 focus:outline-none">{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-4">
                <button type="button" onClick={closeModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:shadow-outline">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-red-700 hover:bg-red-800 disabled:bg-red-500/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:shadow-outline flex items-center">
                  {isSubmitting && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  {isSubmitting ? 'Deleting...' : 'Delete Account Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteAccountForm;