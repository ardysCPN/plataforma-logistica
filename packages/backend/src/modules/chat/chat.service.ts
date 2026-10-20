import { db } from '../../config/database';
import { SendChatMessageInput, ChatMessage } from '@plataforma/shared';

export const chatService = {
  async saveMessage(senderId: string, input: SendChatMessageInput): Promise<ChatMessage> {
    // 1. Validar que la orden exista y el remitente participe en ella
    const orderRes = await db.query(
      `SELECT client_id as "clientId", courier_id as "courierId" FROM service_orders WHERE id = $1`,
      [input.orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderRes.rows[0];
    if (order.clientId !== senderId && order.courierId !== senderId) {
      throw new Error('No estás autorizado para enviar mensajes en este servicio');
    }

    // 2. Persistir mensaje
    const res = await db.query<ChatMessage>(
      `INSERT INTO chat_messages (order_id, sender_id, message_type, content, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, order_id as "orderId", sender_id as "senderId",
                 message_type as "messageType", content, image_url as "imageUrl",
                 read_at as "readAt", created_at as "createdAt"`,
      [input.orderId, senderId, input.messageType || 'TEXT', input.content, input.imageUrl || null]
    );

    return res.rows[0];
  },

  async getChatHistory(orderId: string, userId: string): Promise<ChatMessage[]> {
    // Validar membresía en la orden
    const orderRes = await db.query(
      `SELECT client_id as "clientId", courier_id as "courierId" FROM service_orders WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderRes.rows[0];
    if (order.clientId !== userId && order.courierId !== userId) {
      throw new Error('No estás autorizado para ver este chat');
    }

    const res = await db.query<ChatMessage>(
      `SELECT id, order_id as "orderId", sender_id as "senderId",
              message_type as "messageType", content, image_url as "imageUrl",
              read_at as "readAt", created_at as "createdAt"
       FROM chat_messages
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    );

    return res.rows;
  },
};
