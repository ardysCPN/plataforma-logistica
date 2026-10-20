import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app';
import { env } from './config/env';
import { initSocketManager } from './sockets/socket.manager';

export const httpServer = http.createServer(app);

// Inicialización de Socket.io con CORS
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Inicializar Manejador de Sockets
initSocketManager(io);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${env.PORT}`);
    console.log(`📡 Socket.io activo en el mismo puerto`);
  });
}
