import { Request, Response } from 'express';
import { kycService } from './kyc.service';

export const kycController = {
  async uploadDocuments(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'COURIER') {
        res.status(403).json({ error: 'Solo los conductores pueden subir documentos KYC' });
        return;
      }
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const result = await kycService.updateDocuments(req.user.id, files);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error subiendo documentos';
      res.status(400).json({ error: message });
    }
  },

  async getPendingCouriers(_req: Request, res: Response): Promise<void> {
    try {
      const couriers = await kycService.getPendingCouriers();
      res.json(couriers);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error listando conductores pendientes';
      res.status(500).json({ error: message });
    }
  },

  async reviewCourier(req: Request, res: Response): Promise<void> {
    try {
      const { userId, approve, reason } = req.body;
      if (!userId || typeof approve !== 'boolean') {
        res.status(400).json({ error: 'Parámetros userId y approve son requeridos' });
        return;
      }
      const result = await kycService.reviewCourier(userId, approve, reason);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error revisando conductor';
      res.status(400).json({ error: message });
    }
  },
};
