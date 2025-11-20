import apiClient from './apiClient';

interface LoginResponse {
  jwt: string;
  darkmodePreference: boolean;
  twoFactorEnabled: boolean; 
  twoFactorRequired: boolean;
  tempToken: string;
  recentSearches: string[];
}

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(`/auth/login`, { email, password });
  return response.data;
};

export const verify2FALogin = async (tempToken: string, code: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(`/auth/2fa-login`, { tempToken, code });
  return response.data;
};

export const registerUser = async (email: string, password: string): Promise<string> => {
  const response = await apiClient.post(`/auth/register`, { email, password });
  return response.data;
};


export const forgotPassword = async (email: string): Promise<string> => {
  const response = await apiClient.post(`/auth/forgot-password`, { email });
  return response.data;
};

export const validateResetToken = async (token: string): Promise<string> => {
  const response = await apiClient.get(`/auth/validate-reset-token`, {
    params: { token }
  });
  return response.data;
};

export const verifyEmail = async (token: string, signal?: AbortSignal) => {
  const response = await apiClient.get(`/auth/verify?token=${token}`, { signal });
  if (response.data && (response.data.error || response.data.success === false)) {
    throw new Error(response.data.message || response.data.error || 'Email verification failed.');
  }
  return response.data;
};

export const resetPassword = async (token: string, newPassword: string): Promise<string> => {
  const response = await apiClient.post(`/auth/reset-password`, { token, newPassword });
  return response.data;
};

