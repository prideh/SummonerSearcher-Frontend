import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useErrorStore } from '../store/errorStore';

/**
 * Creates and configures an Axios instance for making API requests.
 * The baseURL is set from environment variables, pointing to the backend API.
 */
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
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
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 429) {
      useErrorStore.getState().setShowRateLimitError(true);
    }
    return Promise.reject(error);
  }
);

export default apiClient;