import { Router } from 'express';
import { biddingController } from './bidding.controller';
import { authenticateJWT, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createBidSchema, acceptBidSchema } from '@plataforma/shared';

export const biddingRouter = Router();

biddingRouter.post(
  '/',
  authenticateJWT,
  requireRole(['COURIER']),
  validate(createBidSchema),
  biddingController.submitBid
);

biddingRouter.post(
  '/accept',
  authenticateJWT,
  requireRole(['CLIENT']),
  validate(acceptBidSchema),
  biddingController.acceptBid
);

biddingRouter.post(
  '/claim-errand/:orderId',
  authenticateJWT,
  requireRole(['COURIER']),
  biddingController.claimErrand
);

biddingRouter.get(
  '/order/:orderId',
  authenticateJWT,
  biddingController.getOrderBids
);
