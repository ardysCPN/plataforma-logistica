import { Router } from 'express';
import { orderController } from './order.controller';
import { authenticateJWT, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createOrderSchema, verifyOtpSchema } from '@plataforma/shared';

export const orderRouter = Router();

orderRouter.post(
  '/',
  authenticateJWT,
  requireRole(['CLIENT']),
  validate(createOrderSchema),
  orderController.createOrder
);

orderRouter.get('/nearby-couriers', authenticateJWT, orderController.getNearbyCouriers);
orderRouter.get('/available', authenticateJWT, orderController.getAvailable);

orderRouter.get('/:id', authenticateJWT, orderController.getOrder);

orderRouter.post(
  '/:orderId/cancel',
  authenticateJWT,
  requireRole(['CLIENT']),
  orderController.cancelOrder
);

orderRouter.patch(
  '/:orderId/status',
  authenticateJWT,
  requireRole(['COURIER']),
  orderController.updateStatus
);

orderRouter.post(
  '/complete-pin',
  authenticateJWT,
  requireRole(['COURIER']),
  validate(verifyOtpSchema),
  orderController.verifyPin
);
