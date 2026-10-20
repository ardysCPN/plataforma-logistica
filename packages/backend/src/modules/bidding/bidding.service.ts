import { db } from '../../config/database';
import { CreateBidInput, AcceptBidInput, OrderBid } from '@plataforma/shared';

export const biddingService = {
  async submitBid(courierId: string, input: CreateBidInput) {
    // 1. Validar que el conductor esté ACTIVO y tenga saldo positivo en billetera
    const courierRes = await db.query(
      `SELECT u.status, u.wallet_balance as "walletBalance", cp.active_orders_count as "activeOrdersCount"
       FROM users u
       JOIN courier_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [courierId]
    );

    if (courierRes.rows.length === 0) {
      throw new Error('Perfil de conductor no encontrado');
    }

    const courier = courierRes.rows[0];
    if (courier.status !== 'ACTIVE') {
      throw new Error('Tu cuenta no está activa para ofertar');
    }

    if (Number(courier.walletBalance) <= 0) {
      throw new Error('Saldo insuficiente en tu billetera. Recarga saldo para seguir ofertando.');
    }

    if (Number(courier.activeOrdersCount) >= 3) {
      throw new Error('Has alcanzado el límite máximo de 3 pedidos activos simultáneos.');
    }

    // 2. Validar que la orden esté en estado SEARCHING
    const orderRes = await db.query(
      `SELECT id, status, service_type as "serviceType" FROM service_orders WHERE id = $1`,
      [input.orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    if (orderRes.rows[0].status !== 'SEARCHING') {
      throw new Error('La orden ya no está disponible para recibir ofertas');
    }

    // 3. Insertar o actualizar oferta del conductor para esta orden
    const res = await db.query(
      `INSERT INTO order_bids (order_id, courier_id, bid_amount, eta_minutes, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id, order_id as "orderId", courier_id as "courierId",
                 bid_amount as "bidAmount", eta_minutes as "etaMinutes",
                 status, created_at as "createdAt"`,
      [input.orderId, courierId, input.bidAmount, input.etaMinutes || null]
    );

    return res.rows[0];
  },

  async acceptBid(clientId: string, input: AcceptBidInput) {
    return db.transaction(async (client) => {
      // 1. Bloquear orden
      const orderRes = await client.query(
        `SELECT id, client_id as "clientId", status FROM service_orders WHERE id = $1 FOR UPDATE`,
        [input.orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Orden no encontrada');
      }

      const order = orderRes.rows[0];
      if (order.clientId !== clientId) {
        throw new Error('Solo el cliente que solicitó la orden puede aceptar una oferta');
      }

      if (order.status !== 'SEARCHING') {
        throw new Error('La orden ya ha sido asignada o cancelada');
      }

      // 2. Obtener y validar la oferta
      const bidRes = await client.query(
        `SELECT id, courier_id as "courierId", bid_amount as "bidAmount"
         FROM order_bids
         WHERE id = $1 AND order_id = $2 FOR UPDATE`,
        [input.bidId, input.orderId]
      );

      if (bidRes.rows.length === 0) {
        throw new Error('Oferta no encontrada');
      }

      const bid = bidRes.rows[0];

      // 3. Marcar la oferta seleccionada como ACCEPTED y las demás como REJECTED
      await client.query(
        `UPDATE order_bids SET status = 'ACCEPTED' WHERE id = $1`,
        [bid.id]
      );

      await client.query(
        `UPDATE order_bids SET status = 'REJECTED' WHERE order_id = $1 AND id != $2`,
        [input.orderId, bid.id]
      );

      // 4. Asignar orden al conductor
      await client.query(
        `UPDATE service_orders
         SET courier_id = $1, agreed_price = $2, status = 'ACCEPTED'
         WHERE id = $3`,
        [bid.courierId, bid.bidAmount, input.orderId]
      );

      // 5. Incrementar pedidos activos del conductor
      await client.query(
        `UPDATE courier_profiles
         SET active_orders_count = active_orders_count + 1
         WHERE user_id = $1`,
        [bid.courierId]
      );

      return {
        orderId: input.orderId,
        courierId: bid.courierId,
        agreedPrice: Number(bid.bidAmount),
        status: 'ACCEPTED',
      };
    });
  },

  async claimErrandAtomic(courierId: string, orderId: string) {
    return db.transaction(async (client) => {
      // 1. Validar conductor activo y con saldo
      const courierRes = await client.query(
        `SELECT u.status, u.wallet_balance as "walletBalance", cp.active_orders_count as "activeOrdersCount"
         FROM users u
         JOIN courier_profiles cp ON u.id = cp.user_id
         WHERE u.id = $1`,
        [courierId]
      );

      if (courierRes.rows.length === 0 || courierRes.rows[0].status !== 'ACTIVE') {
        throw new Error('Conductor no activo para tomar mandados');
      }

      if (Number(courierRes.rows[0].walletBalance) <= 0) {
        throw new Error('Saldo insuficiente en billetera');
      }

      if (Number(courierRes.rows[0].activeOrdersCount) >= 3) {
        throw new Error('Límite de pedidos activos alcanzado');
      }

      // 2. Bloqueo atómico exclusivo de la fila de la orden
      const orderRes = await client.query(
        `SELECT id, service_type as "serviceType", status, offered_price as "offeredPrice"
         FROM service_orders
         WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Mandado no encontrado');
      }

      const order = orderRes.rows[0];
      if (order.serviceType !== 'ERRAND') {
        throw new Error('Esta orden no es un mandado directo');
      }

      if (order.status !== 'SEARCHING') {
        throw new Error('¡Lo sentimos! Otro conductor acaba de tomar este mandado.');
      }

      // 3. Adjudicar de inmediato al primer aceptante
      await client.query(
        `UPDATE service_orders
         SET courier_id = $1, agreed_price = offered_price, status = 'ACCEPTED'
         WHERE id = $2`,
        [courierId, orderId]
      );

      await client.query(
        `UPDATE courier_profiles
         SET active_orders_count = active_orders_count + 1
         WHERE user_id = $1`,
        [courierId]
      );

      return {
        orderId,
        courierId,
        agreedPrice: Number(order.offeredPrice),
        status: 'ACCEPTED',
        message: '¡Mandado adjudicado exitosamente!',
      };
    });
  },

  async getOrderBids(orderId: string): Promise<OrderBid[]> {
    const res = await db.query(
      `SELECT ob.id, ob.order_id as "orderId", ob.courier_id as "courierId",
              ob.bid_amount as "bidAmount", ob.eta_minutes as "etaMinutes",
              ob.status, ob.created_at as "createdAt",
              u.full_name as "courierName", u.rating_avg as "ratingAvg", u.rating_count as "ratingCount",
              cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate"
       FROM order_bids ob
       JOIN users u ON ob.courier_id = u.id
       JOIN courier_profiles cp ON u.id = cp.user_id
       WHERE ob.order_id = $1
       ORDER BY ob.bid_amount ASC, ob.created_at ASC`,
      [orderId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      courierId: r.courierId,
      bidAmount: Number(r.bidAmount),
      etaMinutes: r.etaMinutes,
      status: r.status,
      createdAt: r.createdAt,
      courier: {
        fullName: r.courierName,
        ratingAvg: Number(r.ratingAvg),
        ratingCount: r.ratingCount,
        vehicleType: r.vehicleType,
        vehiclePlate: r.vehiclePlate,
      },
    }));
  },
};
