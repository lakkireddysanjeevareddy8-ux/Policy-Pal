import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let isFirstRequest = true;
let wakingUpTimer = null;

// Request interceptor: add auth token & start 4-second waking up timer
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('policypal_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (isFirstRequest) {
      wakingUpTimer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('policypal:waking-up', { detail: true }));
      }, 4000);
    }

    return config;
  },
  (error) => {
    if (isFirstRequest && wakingUpTimer) clearTimeout(wakingUpTimer);
    return Promise.reject(error);
  }
);

// Response interceptor: handle 401s and cancel waking up timer
api.interceptors.response.use(
  (response) => {
    if (isFirstRequest) {
      isFirstRequest = false;
      if (wakingUpTimer) clearTimeout(wakingUpTimer);
      window.dispatchEvent(new CustomEvent('policypal:waking-up', { detail: false }));
    }
    return response;
  },
  (error) => {
    if (isFirstRequest) {
      isFirstRequest = false;
      if (wakingUpTimer) clearTimeout(wakingUpTimer);
      window.dispatchEvent(new CustomEvent('policypal:waking-up', { detail: false }));
    }

    if (error.response && error.response.status === 401) {
      // Clear token on unauthorized if not checking auth status
      if (!error.config.url.includes('/auth/me') && !error.config.url.includes('/auth/login')) {
        localStorage.removeItem('policypal_token');
        localStorage.removeItem('policypal_user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
