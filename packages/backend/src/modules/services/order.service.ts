import crypto from 'crypto';
import { db } from '../../config/database';
import { CreateOrderInput, ServiceOrder, OrderStatus } from '@plataforma/shared';
import { socketEvents } from '../../sockets/socket.manager';

export const orderService = {
  async createOrder(clientId: string, input: CreateOrderInput) {
    // Generar código OTP aleatorio de 4 dígitos
    const deliveryPin = Math.floor(1000 + crypto.randomInt(9000)).toString();

    const query = `
      INSERT INTO service_orders (
        client_id, service_type, status,
        origin_address, origin_point,
        destination_address, destination_point,
        description_notes, estimated_purchase_cost,
        offered_price, delivery_pin
      )
      VALUES (
        $1, $2, 'SEARCHING',
        $3, ST_SetSRID(ST_MakePoint($4, $5), 4326),
        $6, ST_SetSRID(ST_MakePoint($7, $8), 4326),
        $9, $10,
        $11, $12
      )
      RETURNING id, client_id as "clientId", service_type as "serviceType", status,
                origin_address as "originAddress",
                ST_Y(origin_point::geometry) as "originLat", ST_X(origin_point::geometry) as "originLng",
                destination_address as "destinationAddress",
                ST_Y(destination_point::geometry) as "destLat", ST_X(destination_point::geometry) as "destLng",
                description_notes as "descriptionNotes", estimated_purchase_cost as "estimatedPurchaseCost",
                offered_price as "offeredPrice", delivery_pin as "deliveryPin",
                created_at as "createdAt"
    `;

    const values = [
      clientId,
      input.serviceType,
      input.originAddress,
      input.originPoint.longitude,
      input.originPoint.latitude,
      input.destinationAddress,
      input.destinationPoint.longitude,
      input.destinationPoint.latitude,
      input.descriptionNotes || null,
      input.estimatedPurchaseCost || 0,
      input.offeredPrice,
      deliveryPin,
    ];

    const res = await db.query(query, values);
    const row = res.rows[0];

    const createdOrder = {
      id: row.id,
      clientId: row.clientId,
      serviceType: row.serviceType,
      status: row.status,
      originAddress: row.originAddress,
      originPoint: { latitude: Number(row.originLat), longitude: Number(row.originLng) },
      destinationAddress: row.destinationAddress,
      destinationPoint: { latitude: Number(row.destLat), longitude: Number(row.destLng) },
      descriptionNotes: row.descriptionNotes,
      estimatedPurchaseCost: Number(row.estimatedPurchaseCost),
      offeredPrice: Number(row.offeredPrice),
      deliveryPin: row.deliveryPin,
      createdAt: row.createdAt,
    };

    // Emitir a todos los conductores activos para radar en tiempo real
    socketEvents.emitNewOrderAvailable({
      orderId: createdOrder.id,
      serviceType: createdOrder.serviceType,
      originAddress: createdOrder.originAddress,
      originPoint: createdOrder.originPoint,
      destinationAddress: createdOrder.destinationAddress,
      destinationPoint: createdOrder.destinationPoint,
      offeredPrice: createdOrder.offeredPrice,
      descriptionNotes: createdOrder.descriptionNotes,
      estimatedPurchaseCost: createdOrder.estimatedPurchaseCost,
      createdAt: new Date().toISOString(),
    });

    return createdOrder;
  },

  async updateStatus(orderId: string, courierId: string, newStatus: OrderStatus) {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      SEARCHING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['ARRIVED_AT_ORIGIN', 'CANCELLED'],
      ARRIVED_AT_ORIGIN: ['PURCHASING', 'PICKED_UP', 'CANCELLED'],
      PURCHASING: ['PICKED_UP', 'CANCELLED'],
      PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const orderRes = await db.query(
      `SELECT id, courier_id as "courierId", status FROM service_orders WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderRes.rows[0];
    if (order.courierId !== courierId) {
      throw new Error('No tienes asignada esta orden');
    }

    const allowed = validTransitions[order.status as OrderStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Transición no válida de ${order.status} a ${newStatus}`);
    }

    await db.query(
      `UPDATE service_orders SET status = $1 WHERE id = $2`,
      [newStatus, orderId]
    );

    return { orderId, newStatus };
  },

  async completeOrderWithPin(orderId: string, courierId: string, inputPin: string) {
    return db.transaction(async (client) => {
      // Bloquear orden para evitar dobles cierres o condiciones de carrera
      const orderRes = await client.query(
        `SELECT id, client_id as "clientId", courier_id as "courierId", status,
                delivery_pin as "deliveryPin", agreed_price as "agreedPrice", offered_price as "offeredPrice"
         FROM service_orders
         WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Orden no encontrada');
      }

      const order = orderRes.rows[0];
      if (order.courierId !== courierId) {
        throw new Error('No estás asignado a esta orden');
      }

      if (order.status === 'COMPLETED') {
        throw new Error('La orden ya ha sido completada previamente');
      }

      if (order.status !== 'IN_TRANSIT' && order.status !== 'PICKED_UP') {
        throw new Error('La orden debe estar en tránsito para poder completarse');
      }

      if (order.deliveryPin !== inputPin) {
        throw new Error('PIN OTP incorrecto. Solicita al cliente el código de 4 dígitos de su pantalla.');
      }

      const finalPrice = Number(order.agreedPrice || order.offeredPrice);
      const commissionRate = 0.10; // 10% de comisión de la plataforma
      const commissionAmount = Math.round(finalPrice * commissionRate);

      // Obtener y bloquear billetera del conductor
      const courierRes = await client.query(
        `SELECT id, wallet_balance as "walletBalance" FROM users WHERE id = $1 FOR UPDATE`,
        [courierId]
      );
      const currentBalance = Number(courierRes.rows[0].walletBalance);
      const newBalance = currentBalance - commissionAmount;

      // Actualizar estado de orden
      await client.query(
        `UPDATE service_orders
         SET status = 'COMPLETED', completed_at = NOW(), commission_amount = $1
         WHERE id = $2`,
        [commissionAmount, orderId]
      );

      // Debitar comisión en la billetera del conductor
      await client.query(
        `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
        [newBalance, courierId]
      );

      // Registrar movimiento contable en el libro mayor
      await client.query(
        `INSERT INTO wallet_transactions (courier_id, order_id, tx_type, amount, balance_after, notes)
         VALUES ($1, $2, 'COMMISSION_DEDUCTION', $3, $4, $5)`,
        [
          courierId,
          orderId,
          commissionAmount,
          newBalance,
          `Comisión del 10% por orden #${orderId.substring(0, 8)}`,
        ]
      );

      // Disminuir contador de órdenes activas del conductor
      await client.query(
        `UPDATE courier_profiles
         SET active_orders_count = GREATEST(0, active_orders_count - 1)
         WHERE user_id = $1`,
        [courierId]
      );

      return {
        orderId,
        status: 'COMPLETED',
        finalPrice,
        commissionDeducted: commissionAmount,
        walletBalance: newBalance,
      };
    });
  },

  async getOrderById(orderId: string, userId: string) {
    const res = await db.query(
      `SELECT so.id, so.client_id as "clientId", so.courier_id as "courierId",
              so.service_type as "serviceType", so.status,
              so.origin_address as "originAddress",
              ST_Y(so.origin_point::geometry) as "originLat", ST_X(so.origin_point::geometry) as "originLng",
              so.destination_address as "destinationAddress",
              ST_Y(so.destination_point::geometry) as "destLat", ST_X(so.destination_point::geometry) as "destLng",
              so.description_notes as "descriptionNotes", so.estimated_purchase_cost as "estimatedPurchaseCost",
              so.offered_price as "offeredPrice", so.agreed_price as "agreedPrice",
              so.commission_amount as "commissionAmount",
              CASE WHEN so.client_id = $2 THEN so.delivery_pin ELSE NULL END as "deliveryPin",
              so.created_at as "createdAt", so.completed_at as "completedAt",
              cu.full_name as "courierName", cu.phone as "courierPhone", cu.rating_avg as "courierRating",
              cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate"
       FROM service_orders so
       LEFT JOIN users cu ON so.courier_id = cu.id
       LEFT JOIN courier_profiles cp ON cu.id = cp.user_id
       WHERE so.id = $1`,
      [orderId, userId]
    );

    if (res.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const r = res.rows[0];
    return {
      id: r.id,
      clientId: r.clientId,
      courierId: r.courierId,
      serviceType: r.serviceType,
      status: r.status,
      originAddress: r.originAddress,
      originPoint: { latitude: Number(r.originLat), longitude: Number(r.originLng) },
      destinationAddress: r.destinationAddress,
      destinationPoint: { latitude: Number(r.destLat), longitude: Number(r.destLng) },
      descriptionNotes: r.descriptionNotes,
      estimatedPurchaseCost: Number(r.estimatedPurchaseCost),
      offeredPrice: Number(r.offeredPrice),
      agreedPrice: r.agreedPrice ? Number(r.agreedPrice) : null,
      commissionAmount: Number(r.commissionAmount),
      deliveryPin: r.deliveryPin,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      courier: r.courierId ? {
        fullName: r.courierName,
        phone: r.courierPhone,
        ratingAvg: Number(r.courierRating),
        vehicleType: r.vehicleType,
        vehiclePlate: r.vehiclePlate,
      } : null,
    };
  },

  async cancelOrder(orderId: string, clientId: string) {
    const res = await db.query(
      `SELECT id, client_id as "clientId", courier_id as "courierId", status
       FROM service_orders WHERE id = $1`,
      [orderId]
    );

    if (res.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = res.rows[0];
    if (order.clientId !== clientId) {
      throw new Error('No estás autorizado para cancelar esta orden');
    }

    if (order.status === 'COMPLETED') {
      throw new Error('No se puede cancelar una orden que ya fue completada');
    }

    if (order.status === 'CANCELLED') {
      throw new Error('La orden ya fue cancelada previamente');
    }

    await db.query(
      `UPDATE service_orders SET status = 'CANCELLED' WHERE id = $1`,
      [orderId]
    );

    // Si había conductor asignado, liberar su contador de órdenes
    if (order.courierId) {
      await db.query(
        `UPDATE courier_profiles
         SET active_orders_count = GREATEST(0, active_orders_count - 1)
         WHERE user_id = $1`,
        [order.courierId]
      );
    }

    // Notificar por WebSockets
    socketEvents.emitOrderCancelled(orderId);
    socketEvents.emitOrderStatusChange(orderId, {
      orderId,
      newStatus: 'CANCELLED',
      updatedAt: new Date().toISOString(),
      details: { message: 'La orden fue cancelada por el cliente' },
    });

    return {
      orderId,
      status: 'CANCELLED',
      message: 'Orden cancelada exitosamente',
    };
  },

  async getNearbyCouriers(latitude: number, longitude: number, radiusMeters: number = 15000) {
    const res = await db.query(
      `SELECT u.id, u.full_name as "fullName", u.rating_avg as "ratingAvg",
              cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate",
              cp.is_online as "isOnline",
              ST_Y(cp.current_location::geometry) as latitude,
              ST_X(cp.current_location::geometry) as longitude,
              COALESCE(cp.current_bearing, 0) as bearing,
              ROUND(ST_Distance(cp.current_location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 0) as "distanceMeters"
       FROM courier_profiles cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.current_location IS NOT NULL
         AND cp.is_online = TRUE
       ORDER BY "distanceMeters" ASC
       LIMIT 20`,
      [longitude, latitude]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      fullName: r.fullName,
      ratingAvg: Number(r.ratingAvg),
      vehicleType: r.vehicleType,
      vehiclePlate: r.vehiclePlate,
      isOnline: r.isOnline,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      bearing: Number(r.bearing),
      distanceMeters: Number(r.distanceMeters),
    }));
  },

  async getAvailableOrders() {
    const res = await db.query(
      `SELECT id as "orderId", service_type as "serviceType", status,
              origin_address as "originAddress",
              ST_Y(origin_point::geometry) as "originLat", ST_X(origin_point::geometry) as "originLng",
              destination_address as "destinationAddress",
              ST_Y(destination_point::geometry) as "destLat", ST_X(destination_point::geometry) as "destLng",
              description_notes as "descriptionNotes", estimated_purchase_cost as "estimatedPurchaseCost",
              offered_price as "offeredPrice", created_at as "createdAt"
       FROM service_orders
       WHERE status = 'SEARCHING'
       ORDER BY created_at DESC
       LIMIT 30`
    );

    return res.rows.map((row: any) => ({
      orderId: row.orderId,
      serviceType: row.serviceType,
      originAddress: row.originAddress,
      originPoint: { latitude: Number(row.originLat), longitude: Number(row.originLng) },
      destinationAddress: row.destinationAddress,
      destinationPoint: { latitude: Number(row.destLat), longitude: Number(row.destLng) },
      offeredPrice: Number(row.offeredPrice),
      descriptionNotes: row.descriptionNotes,
      estimatedPurchaseCost: Number(row.estimatedPurchaseCost || 0),
      createdAt: row.createdAt,
    }));
  },
};
