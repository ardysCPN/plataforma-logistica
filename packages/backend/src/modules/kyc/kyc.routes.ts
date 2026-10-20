import { Router } from 'express';
import { kycController } from './kyc.controller';
import { uploadKyc } from './kyc.service';
import { authenticateJWT, requireRole } from '../../middlewares/auth';

export const kycRouter = Router();

kycRouter.post(
  '/upload',
  authenticateJWT,
  requireRole(['COURIER']),
  uploadKyc.fields([
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'vehicleDoc', maxCount: 1 },
  ]),
  kycController.uploadDocuments
);

kycRouter.get(
  '/pending',
  authenticateJWT,
  requireRole(['ADMIN']),
  kycController.getPendingCouriers
);

kycRouter.post(
  '/review',
  authenticateJWT,
  requireRole(['ADMIN']),
  kycController.reviewCourier
);
