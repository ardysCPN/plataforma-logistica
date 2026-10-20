import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { db } from '../config/database';
import { chatService } from '../modules/chat/chat.service';
import { AuthUser } from '../middlewares/auth';
import {
  SOCKET_EVENTS,
  SocketLocationUpdatePayload,
  SocketChatSendPayload,
  SocketOrderNewAvailablePayload,
  SocketCorridorAlertPayload,
  SocketBidReceivedPayload,
  SocketOrderAssignedPayload,
  SocketOrderStatusChangePayload,
} from '@plataforma/shared';

export interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
}

let ioInstance: SocketIOServer | null = null;

export const initSocketManager = (io: SocketIOServer) => {
  ioInstance = io;

  // Middleware de Autenticación para Handshake de Sockets
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      // Permitir conexión pública o invitada si fuera necesario, o rechazar
      return next();
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Token de socket inválido o expirado'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (user) {
      // Unirse a sala personal y sala de rol
      socket.join(`user:${user.id}`);
      socket.join(`role:${user.role}`);

      if (user.role === 'COURIER') {
        db.query(`UPDATE courier_profiles SET is_online = TRUE WHERE user_id = $1`, [user.id]);
      }
    }

    // Unirse a sala específica de una orden activa
    socket.on('order:join', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('order:leave', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    // Actualización de ubicación GPS desde el APK del conductor (Foreground Service)
    socket.on(SOCKET_EVENTS.LOCATION_UPDATE, async (payload: SocketLocationUpdatePayload) => {
      if (!user || user.role !== 'COURIER') return;

      try {
        await db.query(
          `UPDATE courier_profiles
           SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
               current_bearing = $3,
               last_ping_at = NOW()
           WHERE user_id = $4`,
          [payload.longitude, payload.latitude, payload.bearing || 0, user.id]
        );

        // Retransmitir coordenadas a los clientes de las órdenes activas
        if (payload.activeOrderIds && payload.activeOrderIds.length > 0) {
          for (const orderId of payload.activeOrderIds) {
            io.to(`order:${orderId}`).emit(SOCKET_EVENTS.LOCATION_CLIENT_FEED, {
              orderId,
              latitude: payload.latitude,
              longitude: payload.longitude,
              bearing: payload.bearing || 0,
            });
          }
        }
      } catch (err) {
        console.error('Error al actualizar posición GPS de conductor:', err);
      }
    });

    // Mensajería de chat en tiempo real
    socket.on(SOCKET_EVENTS.CHAT_SEND, async (payload: SocketChatSendPayload) => {
      if (!user) return;

      try {
        const savedMessage = await chatService.saveMessage(user.id, payload);
        io.to(`order:${payload.orderId}`).emit(SOCKET_EVENTS.CHAT_RECEIVE, savedMessage);

        // Notificación push-like directa al destinatario garantizado
        const recipientId = (savedMessage as any).recipientId;
        if (recipientId) {
          io.to(`user:${recipientId}`).emit(SOCKET_EVENTS.CHAT_RECEIVE, savedMessage);
        }
      } catch (err: unknown) {
        socket.emit('error', {
          event: SOCKET_EVENTS.CHAT_SEND,
          message: err instanceof Error ? err.message : 'Error al enviar mensaje',
        });
      }
    });

    socket.on('disconnect', () => {
      if (user && user.role === 'COURIER') {
        db.query(
          `UPDATE courier_profiles SET is_online = FALSE, last_ping_at = NOW() WHERE user_id = $1`,
          [user.id]
        ).catch(() => {});
      }
    });
  });
};

// Emisores Helper para uso desde los servicios
export const socketEvents = {
  emitNewOrderAvailable(payload: SocketOrderNewAvailablePayload) {
    if (ioInstance) {
      ioInstance.to('role:COURIER').emit(SOCKET_EVENTS.ORDER_NEW_AVAILABLE, payload);
    }
  },

  emitCorridorAlert(courierId: string, payload: SocketCorridorAlertPayload) {
    if (ioInstance) {
      ioInstance.to(`user:${courierId}`).emit(SOCKET_EVENTS.ORDER_CORRIDOR_ALERT, payload);
    }
  },

  emitBidReceived(clientId: string, payload: SocketBidReceivedPayload) {
    if (ioInstance) {
      ioInstance.to(`user:${clientId}`).emit(SOCKET_EVENTS.BID_RECEIVED, payload);
    }
  },

  emitOrderAssigned(orderId: string, payload: SocketOrderAssignedPayload) {
    if (ioInstance) {
      ioInstance.to(`order:${orderId}`).emit(SOCKET_EVENTS.ORDER_ASSIGNED, payload);
      ioInstance.to(`user:${payload.courier.id}`).emit(SOCKET_EVENTS.ORDER_ASSIGNED, payload);
      ioInstance.to(`user:${payload.client.id}`).emit(SOCKET_EVENTS.ORDER_ASSIGNED, payload);
    }
  },

  emitOrderStatusChange(orderId: string, payload: SocketOrderStatusChangePayload) {
    if (ioInstance) {
      ioInstance.to(`order:${orderId}`).emit(SOCKET_EVENTS.ORDER_STATUS_CHANGE, payload);
    }
  },

  emitOrderCancelled(orderId: string) {
    if (ioInstance) {
      ioInstance.to('role:COURIER').emit(SOCKET_EVENTS.ORDER_CANCELLED, { orderId });
      ioInstance.to(`order:${orderId}`).emit(SOCKET_EVENTS.ORDER_CANCELLED, { orderId });
    }
  },
};
