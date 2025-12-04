import apiClient from './apiClient';

/**
 * Initiates the 2FA enabling process for the currently logged-in user.
 * The apiClient automatically includes the Authorization header.
 * @returns A promise that resolves with the QR code URI and the secret key.
 */
export const enable2FA = async () => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.get('/user/2fa/enable');
  return response.data;
};

/**
 * Verifies the 2FA code provided by the user to finalize the enabling process.
 * @param secret - The secret key provided by the `enable2FA` endpoint.
 * @param code - The 6-digit code from the user's authenticator app.
 * @returns A promise that resolves with a success message.
 */
export const verify2FAEnable = async (secret: string, code: number) => {
  const response = await apiClient.post('/user/2fa/verify-enable', { secret, code });
  return response.data;
};

/**
 * Disables 2FA for the currently logged-in user.
 * @param code - The 6-digit code from the user's authenticator app to confirm the action.
 * @returns A promise that resolves with a success message.
 */
export const disable2FA = async (code: number) => {
  const response = await apiClient.post('/user/2fa/disable', { code });
  return response.data;
};

/**
 * Deletes the account of the currently logged-in user.
 * @param password - The user's current password to confirm the action.
 * @returns A promise that resolves with a success message.
 */
export const deleteUser = async (password: string): Promise<string> => {
  // apiClient automatically adds the auth header
  const response = await apiClient.post('/user/delete-account', { password });
  return response.data;
};

/**
 * Changes the password for the currently logged-in user.
 * @param oldPassword - The user's current password.
 * @param newPassword - The user's desired new password.
 * @returns A promise that resolves with a success message.
 */
export const changePassword = async (oldPassword: string, newPassword: string): Promise<string> => {
  // apiClient automatically adds the auth header
  const response = await apiClient.post('/user/change-password', { oldPassword, newPassword });
  return response.data;
};

export interface RecentSearch {
  query: string;
  server: string;
}

/**
 * Fetches the recent search history for the logged-in user.
 * @returns A promise that resolves with an array of recent search objects.
 */
export const getRecentSearches = async (signal?: AbortSignal): Promise<RecentSearch[]> => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.get<RecentSearch[]>('/user/recent-searches', { signal });
  return response.data;
};

/**
 * Clears the recent search history for the logged-in user.
 * @returns A promise that resolves with a success message.
 */
export const clearRecentSearches = async () => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.post('/user/recent-searches/clear');
  return response.data;
};

/**
 * Updates the dark mode preference for the logged-in user in the database.
 * @param enabled - A boolean indicating whether dark mode should be enabled.
 * @returns A promise that resolves with a success message.
 */
export const updateDarkModePreference = async (enabled: boolean) => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.post('/user/settings/darkmode', { enabled });
  return response.data;
};
