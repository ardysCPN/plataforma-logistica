import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { appStorage } from './storage';

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
const joinedOrderRooms = new Set<string>();

export const getSocket = (token?: string | null): Socket => {
  const activeToken = token || appStorage.getItem('auth_token');

  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      autoConnect: true,
      auth: activeToken ? { token: activeToken } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      // Re-unir automáticamente a todas las salas de órdenes activas tras reconexión
      joinedOrderRooms.forEach((orderId) => {
        socketInstance?.emit('order:join', orderId);
      });
    });
  } else if (activeToken && (!socketInstance.auth || (socketInstance.auth as any).token !== activeToken)) {
    socketInstance.auth = { token: activeToken };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }

  return socketInstance;
};

export const joinOrderRoom = (orderId: string) => {
  if (!orderId) return;
  joinedOrderRooms.add(orderId);
  const socket = getSocket();
  if (socket.connected) {
    socket.emit('order:join', orderId);
  }
};

export const leaveOrderRoom = (orderId: string) => {
  if (!orderId) return;
  joinedOrderRooms.delete(orderId);
  const socket = getSocket();
  if (socket.connected) {
    socket.emit('order:leave', orderId);
  }
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
  joinedOrderRooms.clear();
};
