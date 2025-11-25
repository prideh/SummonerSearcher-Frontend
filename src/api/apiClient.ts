import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useErrorStore } from '../store/errorStore';

/**
 * Creates and configures an Axios instance for making API requests.
 * The baseURL is set from environment variables, pointing to the backend API.
 */
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
  withCredentials: true,
});

/**
 * Request interceptor to automatically add the JWT Authorization header to every request.
 * It retrieves the token from the Zustand auth store.
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor for global error handling.
 * Specifically, it listens for 429 (Too Many Requests) errors and displays a
 * prominent banner notification via the error store.
 * Also handles 401 Unauthorized errors by attempting to refresh the token.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 429 Rate Limit
    if (error.response && error.response.status === 429) {
      useErrorStore.getState().setShowRateLimitError(true);
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized (Token Expired)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token
        // We use a new axios instance or direct axios call to avoid infinite loops
        // if the refresh endpoint itself returns 401.
        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh-token`,
          {},
          { withCredentials: true } // Send cookies
        );

        const { jwt } = response.data;

        // Update the token in the store
        useAuthStore.getState().login(jwt, useAuthStore.getState().username || '', useAuthStore.getState().is2faEnabled, useAuthStore.getState().darkMode);

        // Update the Authorization header for the original request
        originalRequest.headers['Authorization'] = `Bearer ${jwt}`;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout the user
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;