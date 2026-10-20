import { Router } from 'express';
import { walletController } from './wallet.controller';
import { authenticateJWT, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createTopupRequestSchema, reviewTopupSchema } from '@plataforma/shared';

export const walletRouter = Router();

walletRouter.post(
  '/topup-request',
  authenticateJWT,
  requireRole(['COURIER']),
  validate(createTopupRequestSchema),
  walletController.requestTopup
);

walletRouter.get(
  '/pending',
  authenticateJWT,
  requireRole(['ADMIN']),
  walletController.getPendingTopups
);

walletRouter.post(
  '/review',
  authenticateJWT,
  requireRole(['ADMIN']),
  validate(reviewTopupSchema),
  walletController.reviewTopup
);

walletRouter.get(
  '/my-wallet',
  authenticateJWT,
  requireRole(['COURIER']),
  walletController.getMyWallet
);
