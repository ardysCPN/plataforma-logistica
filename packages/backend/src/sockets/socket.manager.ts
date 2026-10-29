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

        // Consultar órdenes activas asignadas a este conductor en la BD para garantizar emisión continua
        const ordersRes = await db.query(
          `SELECT id, client_id as "clientId"
           FROM service_orders
           WHERE courier_id = $1
             AND status IN ('ACCEPTED', 'ARRIVED_AT_ORIGIN', 'PURCHASING', 'PICKED_UP', 'IN_TRANSIT')`,
          [user.id]
        );

        const orderIds = new Set<string>(ordersRes.rows.map((r: any) => r.id));
        if (payload.activeOrderIds && Array.isArray(payload.activeOrderIds)) {
          payload.activeOrderIds.forEach((id: string) => orderIds.add(id));
        }

        for (const orderId of orderIds) {
          const clientRow = ordersRes.rows.find((r: any) => r.id === orderId);
          socketEvents.emitLocationFeed(
            orderId,
            {
              orderId,
              latitude: payload.latitude,
              longitude: payload.longitude,
              bearing: payload.bearing || 0,
            },
            clientRow?.clientId
          );
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
        socketEvents.emitChatReceive(savedMessage);
      } catch (err: unknown) {
        socket.emit('error', {
          event: SOCKET_EVENTS.CHAT_SEND,
          message: err instanceof Error ? err.message : 'Error al enviar mensaje',
        });
      }
    });

    // Indicador de escritura en tiempo real ("escribiendo...")
    socket.on(SOCKET_EVENTS.CHAT_TYPING, async (payload: { orderId: string; isTyping: boolean }) => {
      if (!user || !payload?.orderId) return;
      try {
        const orderRes = await db.query(
          `SELECT client_id as "clientId", courier_id as "courierId" FROM service_orders WHERE id = $1`,
          [payload.orderId]
        );
        if (orderRes.rows.length > 0) {
          const order = orderRes.rows[0];
          const recipientId = user.id === order.clientId ? order.courierId : order.clientId;
          socketEvents.emitChatTyping(
            payload.orderId,
            {
              orderId: payload.orderId,
              senderId: user.id,
              senderRole: user.role,
              isTyping: Boolean(payload.isTyping),
            },
            recipientId
          );
        }
      } catch {
        // Ignorar fallos de escritura
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
  emitLocationFeed(
    orderId: string,
    payload: { orderId: string; latitude: number; longitude: number; bearing?: number },
    clientId?: string
  ) {
    if (ioInstance) {
      let broadcaster = ioInstance.to(`order:${orderId}`);
      if (clientId) broadcaster = broadcaster.to(`user:${clientId}`);
      broadcaster.emit(SOCKET_EVENTS.LOCATION_CLIENT_FEED, payload);
    }
  },

  emitChatReceive(message: any) {
    if (ioInstance && message) {
      let broadcaster = ioInstance.to(`order:${message.orderId}`).to(`user:${message.senderId}`);
      if (message.recipientId) {
        broadcaster = broadcaster.to(`user:${message.recipientId}`);
      }
      broadcaster.emit(SOCKET_EVENTS.CHAT_RECEIVE, message);
    }
  },

  emitChatTyping(
    orderId: string,
    payload: { orderId: string; senderId: string; senderRole?: string; isTyping: boolean },
    recipientId?: string
  ) {
    if (ioInstance) {
      let broadcaster = ioInstance.to(`order:${orderId}`);
      if (recipientId) broadcaster = broadcaster.to(`user:${recipientId}`);
      broadcaster.emit(SOCKET_EVENTS.CHAT_TYPING, payload);
    }
  },

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

      // Notificar de inmediato a todos los conductores que la orden fue tomada
      // para que desaparezca de su lista de disponibles
      ioInstance.to('role:COURIER').emit(SOCKET_EVENTS.ORDER_TAKEN, {
        orderId,
        courierId: payload.courier.id,
        message: 'El pedido fue tomado por otro conductor',
      });
    }
  },

  emitOrderStatusChange(
    orderId: string,
    payload: SocketOrderStatusChangePayload,
    clientId?: string,
    courierId?: string
  ) {
    if (ioInstance) {
      let broadcaster = ioInstance.to(`order:${orderId}`);
      if (clientId) broadcaster = broadcaster.to(`user:${clientId}`);
      if (courierId) broadcaster = broadcaster.to(`user:${courierId}`);
      broadcaster.emit(SOCKET_EVENTS.ORDER_STATUS_CHANGE, payload);
    }
  },

  emitOrderCompleted(
    orderId: string,
    payload: unknown,
    clientId?: string,
    courierId?: string
  ) {
    if (ioInstance) {
      let broadcaster = ioInstance.to(`order:${orderId}`);
      if (clientId) broadcaster = broadcaster.to(`user:${clientId}`);
      if (courierId) broadcaster = broadcaster.to(`user:${courierId}`);
      broadcaster.emit(SOCKET_EVENTS.ORDER_COMPLETED, payload);
    }
  },

  emitOrderCancelled(orderId: string, reason?: string) {
    if (ioInstance) {
      const cancelPayload = {
        orderId,
        reason: reason || 'El cliente ha cancelado la solicitud',
      };
      ioInstance.to('role:COURIER').emit(SOCKET_EVENTS.ORDER_CANCELLED, cancelPayload);
      ioInstance.to(`order:${orderId}`).emit(SOCKET_EVENTS.ORDER_CANCELLED, cancelPayload);
    }
  },
};
