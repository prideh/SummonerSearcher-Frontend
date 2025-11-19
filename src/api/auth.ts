import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

interface LoginResponse {
  jwt: string;
  darkmodePreference: boolean;
  twoFactorEnabled: boolean;
  tempToken: string;
  recentSearches: string[];
}

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { email, password });
  return response.data;
};

export const verify2FALogin = async (tempToken: string, code: string): Promise<LoginResponse> => {
  const response = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/2fa-login`, { tempToken, code });
  return response.data;
};

export const registerUser = async (email: string, password: string): Promise<string> => {
  const response = await axios.post(`${API_BASE_URL}/auth/register`, { email, password });
  return response.data;
};


export const forgotPassword = async (email: string): Promise<string> => {
  const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
  return response.data;
};

export const validateResetToken = async (token: string): Promise<string> => {
  const response = await axios.get(`${API_BASE_URL}/auth/validate-reset-token`, {
    params: { token }
  });
  return response.data;
};

export const verifyEmail = async (token: string, signal?: AbortSignal) => {
  const response = await axios.get(`${API_BASE_URL}/auth/verify?token=${token}`, { signal });
  if (response.data && (response.data.error || response.data.success === false)) {
    throw new Error(response.data.message || response.data.error || 'Email verification failed.');
  }
  return response.data;
};

export const resetPassword = async (token: string, newPassword: string): Promise<string> => {
  const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, { token, newPassword });
  return response.data;
};
