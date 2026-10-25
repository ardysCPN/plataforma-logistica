import axios from 'axios';
import { Platform } from 'react-native';

const DEFAULT_API_URL = 'https://domiapi.adhsolutions.tech';

// En Android emulador localhost es 10.0.2.2; en web/dispositivo real se usa la IP de red o variable de entorno
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      return `http://${host}:3001`;
    }
  }
  return DEFAULT_API_URL;
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
    let rawMsg = error.response?.data?.error || error.response?.data?.message;
    let message: string = Array.isArray(rawMsg)
      ? rawMsg.join('. ')
      : typeof rawMsg === 'string'
      ? rawMsg
      : '';

    if (!message) {
      if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
        message = 'El servidor tardó demasiado en responder. Por favor verifica tu conexión e intenta de nuevo.';
      } else if (error.message === 'Network Error' || !error.response) {
        message = 'No se detecta conexión a internet. Revisa tus datos móviles o red WiFi para continuar.';
      } else if (error.response?.status === 401) {
        message = 'Tu sesión ha expirado o el token no es válido. Ingresa nuevamente.';
      } else if (error.response?.status >= 500) {
        message = 'El servidor presentó una sobrecarga temporal. Intenta de nuevo en unos segundos.';
      } else {
        message = error.message || 'Error de comunicación con el servidor';
      }
    }

    return Promise.reject(new Error(message));
  }
);
