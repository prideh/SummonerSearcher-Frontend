import apiClient from './apiClient';

/**
 * Defines the shape of the response object received upon a successful login or 2FA verification.
 */
interface LoginResponse {
  jwt: string;
  darkmodePreference: boolean;
  twoFactorEnabled: boolean; 
  twoFactorRequired: boolean;
  tempToken: string;
  recentSearches: string[];
}

/**
 * Sends a login request to the backend with the user's credentials.
 * @param email - The user's email address.
 * @param password - The user's password.
 * @returns A promise that resolves to the login response data.
 */
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(`/auth/login`, { email, password });
  return response.data;
};

/**
 * Sends a request to verify a 2FA login attempt.
 * @param tempToken - A temporary token issued after correct password entry for a 2FA-enabled account.
 * @param code - The 6-digit code from the user's authenticator app.
 * @returns A promise that resolves to the final login response data.
 */
export const verify2FALogin = async (tempToken: string, code: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(`/auth/2fa-login`, { tempToken, code });
  return response.data;
};

/**
 * Sends a registration request to create a new user account.
 * @param email - The desired email for the new account.
 * @param password - The desired password for the new account.
 * @returns A promise that resolves to a success message from the backend.
 */
export const registerUser = async (email: string, password: string): Promise<string> => {
  const response = await apiClient.post(`/auth/register`, { email, password });
  return response.data;
};

/**
 * Initiates the password reset process for a given email.
 * @param email - The email address of the account needing a password reset.
 * @returns A promise that resolves to a success message.
 */
export const forgotPassword = async (email: string): Promise<string> => {
  const response = await apiClient.post(`/auth/forgot-password`, { email });
  return response.data;
};

/**
 * Validates a password reset token to ensure it's active and legitimate.
 * @param token - The password reset token from the user's email link.
 * @returns A promise that resolves to a success message if the token is valid.
 */
export const validateResetToken = async (token: string, signal?: AbortSignal): Promise<string> => {
  const response = await apiClient.get(`/auth/validate-reset-token`, {
    params: { token },
    signal
  });
  return response.data;
};

/**
 * Verifies a user's email address using a token.
 * @param token - The email verification token from the user's email link.
 * @param signal - An optional AbortSignal to cancel the request.
 * @returns A promise that resolves with the success data from the backend.
 * @throws An error if the backend response indicates a failure.
 */
export const verifyEmail = async (token: string, signal?: AbortSignal) => {
  const response = await apiClient.get(`/auth/verify?token=${token}`, { signal });
  // Custom error handling to ensure downstream catches provide a clear message.
  if (response.data && (response.data.error || response.data.success === false)) {
    throw new Error(response.data.message || response.data.error || 'Email verification failed.');
  }
  return response.data;
};

/**
 * Submits a new password during the password reset process.
 * @param token - The validated password reset token.
 * @param newPassword - The user's new password.
 * @returns A promise that resolves to a success message.
 */
export const resetPassword = async (token: string, newPassword: string): Promise<string> => {
  const response = await apiClient.post(`/auth/reset-password`, { token, newPassword });
  return response.data;
};
