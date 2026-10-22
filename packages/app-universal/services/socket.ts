import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

const DEFAULT_API_URL = 'https://domiapi.adhsolutions.tech';

const getSocketUrl = () => {
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

let socketInstance: Socket | null = null;

export const getSocket = (token?: string | null): Socket => {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      autoConnect: false,
      auth: token ? { token } : undefined,
      transports: ['websocket'],
    });
  } else if (token) {
    socketInstance.auth = { token };
  }

  return socketInstance;
};

export const connectSocket = (token: string) => {
  const socket = getSocket(token);
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
