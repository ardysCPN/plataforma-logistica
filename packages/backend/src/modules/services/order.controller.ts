import { Request, Response } from 'express';
import { orderService } from './order.service';

export const orderController = {
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'CLIENT') {
        res.status(403).json({ error: 'Solo los clientes pueden crear órdenes' });
        return;
      }
      const order = await orderService.createOrder(req.user.id, req.body);
      res.status(201).json(order);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creando la orden';
      res.status(400).json({ error: message });
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'COURIER') {
        res.status(403).json({ error: 'Solo el conductor asignado puede actualizar el estado' });
        return;
      }
      const { orderId } = req.params;
      const { status } = req.body;
      const result = await orderService.updateStatus(orderId, req.user.id, status);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error actualizando estado';
      res.status(400).json({ error: message });
    }
  },

  async verifyPin(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'COURIER') {
        res.status(403).json({ error: 'Solo el conductor asignado puede finalizar la entrega con PIN' });
        return;
      }
      const { orderId, pin } = req.body;
      const result = await orderService.completeOrderWithPin(orderId, req.user.id, pin);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error validando código PIN';
      res.status(400).json({ error: message });
    }
  },

  async getOrder(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const { id } = req.params;
      const order = await orderService.getOrderById(id, req.user.id);
      res.json(order);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error obteniendo la orden';
      res.status(404).json({ error: message });
    }
  },

  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }
      const { orderId } = req.params;
      const result = await orderService.cancelOrder(orderId, req.user.id);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cancelando la orden';
      res.status(400).json({ error: message });
    }
  },

  async getNearbyCouriers(req: Request, res: Response): Promise<void> {
    try {
      const lat = Number(req.query.lat) || 6.2442;
      const lng = Number(req.query.lng) || -75.5812;
      const radius = Number(req.query.radius) || 15000;
      const couriers = await orderService.getNearbyCouriers(lat, lng, radius);
      res.json(couriers);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error obteniendo conductores';
      res.status(500).json({ error: message });
    }
  },

  async getAvailable(req: Request, res: Response): Promise<void> {
    try {
      const orders = await orderService.getAvailableOrders();
      res.json(orders);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error obteniendo órdenes disponibles';
      res.status(500).json({ error: message });
    }
  },
};
