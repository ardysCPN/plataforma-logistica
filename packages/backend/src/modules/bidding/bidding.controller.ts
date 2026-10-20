import { Request, Response } from 'express';
import { biddingService } from './bidding.service';

export const biddingController = {
  async submitBid(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'COURIER') {
        res.status(403).json({ error: 'Solo los conductores pueden ofertar' });
        return;
      }
      const bid = await biddingService.submitBid(req.user.id, req.body);
      res.status(201).json(bid);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar la oferta';
      res.status(400).json({ error: message });
    }
  },

  async acceptBid(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'CLIENT') {
        res.status(403).json({ error: 'Solo los clientes pueden aceptar ofertas' });
        return;
      }
      const result = await biddingService.acceptBid(req.user.id, req.body);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al aceptar la oferta';
      res.status(400).json({ error: message });
    }
  },

  async claimErrand(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'COURIER') {
        res.status(403).json({ error: 'Solo los conductores pueden tomar mandados' });
        return;
      }
      const { orderId } = req.params;
      const result = await biddingService.claimErrandAtomic(req.user.id, orderId);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al tomar el mandado';
      res.status(409).json({ error: message });
    }
  },

  async getOrderBids(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const bids = await biddingService.getOrderBids(orderId);
      res.json(bids);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error listando ofertas';
      res.status(400).json({ error: message });
    }
  },
};
