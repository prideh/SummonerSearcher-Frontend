import apiClient from './apiClient';

export const enable2FA = async () => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.get('/user/2fa/enable');
  return response.data;
};

export const verify2FAEnable = async (secret: string, code: number) => {
  const response = await apiClient.post('/user/2fa/verify-enable', { secret, code });
  return response.data;
};

export const disable2FA = async (code: number) => {
  const response = await apiClient.post('/user/2fa/disable', { code });
  return response.data;
};

export const deleteUser = async (password: string): Promise<string> => {
  // apiClient automatically adds the auth header
  const response = await apiClient.post('/user/delete-account', { password });
  return response.data;
};

export const changePassword = async (oldPassword: string, newPassword: string): Promise<string> => {
  // apiClient automatically adds the auth header
  const response = await apiClient.post('/user/change-password', { oldPassword, newPassword });
  return response.data;
};

export const getRecentSearches = async () => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.get('/user/recent-searches');
  return response.data;
};

export const clearRecentSearches = async () => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.post('/user/recent-searches/clear');
  return response.data;
};

export const updateDarkModePreference = async (enabled: boolean) => {
  // The apiClient from apiClient.ts automatically adds the Authorization header via an interceptor
  const response = await apiClient.post('/user/settings/darkmode', { enabled });
  return response.data;
};
