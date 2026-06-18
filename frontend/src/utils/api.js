import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT access token
api.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle token refresh on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and the request hasn't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        isRefreshing = false;
        useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      try {
        // Direct axios post call to avoid passing the expired header
        const response = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );

        if (response.data?.success) {
          const { token: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
          const user = useAuthStore.getState().user;

          // Update Zustand store
          useAuthStore.getState().setAuth(user, newAccessToken, newRefreshToken);

          // Retry pending request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          isRefreshing = false;

          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }

    // Check if error is due to expired subscription/trial
    if (error.response?.status === 403 && error.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
      try {
        const meRes = await axios.get(`${api.defaults.baseURL}/auth/me`, {
          headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` }
        });
        if (meRes.data?.success && meRes.data?.data?.user) {
          useAuthStore.getState().setAuth(
            meRes.data.data.user,
            useAuthStore.getState().accessToken,
            useAuthStore.getState().refreshToken
          );
        }
      } catch (_) {}
    }

    return Promise.reject(error);
  }
);

export default api;
