import { Request, Response } from 'express';
import { authService, ClientAuditInfo } from './auth.service';

const getAuditInfo = (req: Request): ClientAuditInfo => ({
  ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
  userAgent: req.headers['user-agent'],
  deviceHash: req.body.deviceHash,
});

export const authController = {
  async registerClient(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.registerClient(req.body, getAuditInfo(req));
      res.status(201).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en el registro';
      res.status(400).json({ error: message });
    }
  },

  async registerCourier(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.registerCourier(req.body, getAuditInfo(req));
      res.status(201).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en el registro';
      res.status(400).json({ error: message });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en el inicio de sesión';
      res.status(401).json({ error: message });
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const data = await authService.getMe(req.user.id);
      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error obteniendo perfil';
      res.status(404).json({ error: message });
    }
  },
};
