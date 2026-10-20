import { Request, Response } from 'express';
import { walletService } from './wallet.service';

export const walletController = {
  async requestTopup(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'COURIER') {
        res.status(403).json({ error: 'Solo los conductores pueden solicitar recargas' });
        return;
      }
      const result = await walletService.requestTopup(req.user.id, req.body);
      res.status(201).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creando solicitud de recarga';
      res.status(400).json({ error: message });
    }
  },

  async reviewTopup(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Solo los administradores pueden revisar recargas' });
        return;
      }
      const { topupId, approved, rejectionReason } = req.body;
      const result = await walletService.reviewTopup(req.user.id, topupId, approved, rejectionReason);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error procesando recarga';
      res.status(400).json({ error: message });
    }
  },

  async getPendingTopups(_req: Request, res: Response): Promise<void> {
    try {
      const topups = await walletService.getPendingTopups();
      res.json(topups);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error listando recargas pendientes';
      res.status(500).json({ error: message });
    }
  },

  async getMyWallet(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const wallet = await walletService.getCourierWallet(req.user.id);
      res.json(wallet);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error obteniendo saldo de billetera';
      res.status(500).json({ error: message });
    }
  },
};
