import { db } from '../../config/database';
import { SendChatMessageInput, ChatMessage } from '@plataforma/shared';

export const chatService = {
  async saveMessage(senderId: string, input: SendChatMessageInput): Promise<ChatMessage> {
    // 1. Validar que la orden exista y el remitente participe en ella
    const orderRes = await db.query(
      `SELECT client_id as "clientId", courier_id as "courierId", status FROM service_orders WHERE id = $1`,
      [input.orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderRes.rows[0];
    if (order.clientId !== senderId && order.courierId !== senderId) {
      throw new Error('No estás autorizado para enviar mensajes en este servicio');
    }

    // Regla de privacidad Uber/InDrive: El conductor no puede iniciar nuevos mensajes si el pedido ya fue finalizado o cancelado
    if ((order.status === 'COMPLETED' || order.status === 'CANCELLED') && senderId === order.courierId) {
      throw new Error('El servicio ha finalizado. Por seguridad y privacidad del usuario, el chat se encuentra en modo solo lectura.');
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

    const userRes = await db.query(`SELECT full_name as "fullName" FROM users WHERE id = $1`, [senderId]);
    const senderName = userRes.rows[0]?.fullName || 'Usuario';
    const recipientId = senderId === order.clientId ? order.courierId : order.clientId;

    return {
      ...res.rows[0],
      senderName,
      recipientId,
    } as any;
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

  async getUserChatConversations(userId: string): Promise<any[]> {
    const res = await db.query(
      `SELECT 
        o.id as "orderId",
        o.service_type as "serviceType",
        o.status as "orderStatus",
        o.origin_address as "originAddress",
        o.destination_address as "destinationAddress",
        o.created_at as "orderCreatedAt",
        CASE WHEN o.client_id = $1 THEN COALESCE(uc.full_name, 'Conductor') ELSE COALESCE(ucl.full_name, 'Cliente') END as "counterpartName",
        CASE WHEN o.client_id = $1 THEN COALESCE(uc.phone, '') ELSE COALESCE(ucl.phone, '') END as "counterpartPhone",
        (SELECT content FROM chat_messages cm WHERE cm.order_id = o.id ORDER BY cm.created_at DESC LIMIT 1) as "lastMessage",
        (SELECT created_at FROM chat_messages cm WHERE cm.order_id = o.id ORDER BY cm.created_at DESC LIMIT 1) as "lastMessageAt",
        (SELECT COUNT(*)::int FROM chat_messages cm WHERE cm.order_id = o.id AND cm.sender_id != $1 AND cm.read_at IS NULL) as "unreadCount"
      FROM service_orders o
      LEFT JOIN users uc ON o.courier_id = uc.id
      LEFT JOIN users ucl ON o.client_id = ucl.id
      WHERE (o.client_id = $1 OR o.courier_id = $1)
      ORDER BY COALESCE((SELECT created_at FROM chat_messages cm WHERE cm.order_id = o.id ORDER BY cm.created_at DESC LIMIT 1), o.created_at) DESC
      LIMIT 30`,
      [userId]
    );

    return res.rows;
  },
};
