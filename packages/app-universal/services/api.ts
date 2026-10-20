import axios from 'axios';
import { Platform } from 'react-native';

// En Android emulador localhost es 10.0.2.2; en web/dispositivo real se usa la IP de red o variable de entorno
const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  currentToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Error de conexión';
    return Promise.reject(new Error(message));
  }
);
