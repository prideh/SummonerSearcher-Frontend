import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';

const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
});

// Use an interceptor to automatically add the token to every authenticated request
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

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 429) {
      toast.error('Rate limit exceeded, please try again later.');
    }
    return Promise.reject(error);
  }
);

export default apiClient;