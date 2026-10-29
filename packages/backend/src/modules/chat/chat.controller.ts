import { Request, Response } from 'express';
import { chatService } from './chat.service';
import { socketEvents } from '../../sockets/socket.manager';

export const chatController = {
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const message = await chatService.saveMessage(req.user.id, req.body);
      socketEvents.emitChatReceive(message);
      res.status(201).json(message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar mensaje';
      res.status(400).json({ error: message });
    }
  },

  async getChatHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const { orderId } = req.params;
      const history = await chatService.getChatHistory(orderId, req.user.id);
      res.json(history);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener historial';
      res.status(403).json({ error: message });
    }
  },

  async getUserChats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const chats = await chatService.getUserChatConversations(req.user.id);
      res.json(chats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener conversaciones';
      res.status(500).json({ error: message });
    }
  },
};
