import { Router } from 'express';
import { chatController } from './chat.controller';
import { authenticateJWT } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { sendChatMessageSchema } from '@plataforma/shared';

export const chatRouter = Router();

chatRouter.post('/', authenticateJWT, validate(sendChatMessageSchema), chatController.sendMessage);
chatRouter.get('/my-chats', authenticateJWT, chatController.getUserChats);
chatRouter.get('/history/:orderId', authenticateJWT, chatController.getChatHistory);
