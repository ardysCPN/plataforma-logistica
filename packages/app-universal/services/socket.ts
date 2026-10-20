import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

const getSocketUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
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
