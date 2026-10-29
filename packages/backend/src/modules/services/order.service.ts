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
      PICKED_UP: ['IN_TRANSIT'],
      IN_TRANSIT: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    const orderRes = await db.query(
      `SELECT id, client_id as "clientId", courier_id as "courierId", status FROM service_orders WHERE id = $1`,
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

    const updatedAt = new Date().toISOString();
    socketEvents.emitOrderStatusChange(
      orderId,
      {
        orderId,
        newStatus,
        updatedAt,
      },
      order.clientId,
      courierId
    );

    return { orderId, newStatus, updatedAt };
  },

  async completeOrderWithPin(orderId: string, courierId: string, inputPin: string) {
    const result = await db.transaction(async (client) => {
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
        clientId: order.clientId,
        courierId,
        status: 'COMPLETED' as const,
        finalPrice,
        commissionDeducted: commissionAmount,
        walletBalance: newBalance,
      };
    });

    const updatedAt = new Date().toISOString();
    socketEvents.emitOrderStatusChange(
      orderId,
      {
        orderId,
        newStatus: 'COMPLETED',
        updatedAt,
      },
      result.clientId,
      courierId
    );
    socketEvents.emitOrderCompleted(orderId, result, result.clientId, courierId);

    return result;
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
              cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate",
              ST_Y(cp.current_location::geometry) as "courierLat", ST_X(cp.current_location::geometry) as "courierLng",
              cp.current_bearing as "courierBearing"
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
        currentLocation: r.courierLat && r.courierLng ? {
          latitude: Number(r.courierLat),
          longitude: Number(r.courierLng),
          bearing: Number(r.courierBearing || 0),
        } : null,
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

    if (order.status === 'PICKED_UP' || order.status === 'IN_TRANSIT') {
      throw new Error(
        'No es posible cancelar el viaje una vez que el conductor ha recogido el paquete/pasajero o está en ruta. Debe finalizarse con el PIN de seguridad.'
      );
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

  async getActiveOrderForUser(userId: string, role: string) {
    if (role === 'CLIENT') {
      const res = await db.query(
        `SELECT so.id, so.client_id as "clientId", so.courier_id as "courierId",
                so.service_type as "serviceType", so.status,
                so.origin_address as "originAddress",
                ST_Y(so.origin_point::geometry) as "originLat",
                ST_X(so.origin_point::geometry) as "originLng",
                so.destination_address as "destinationAddress",
                ST_Y(so.destination_point::geometry) as "destLat",
                ST_X(so.destination_point::geometry) as "destLng",
                so.description_notes as "descriptionNotes",
                so.estimated_purchase_cost as "estimatedPurchaseCost",
                so.offered_price as "offeredPrice",
                so.agreed_price as "agreedPrice",
                so.commission_amount as "commissionAmount",
                so.delivery_pin as "deliveryPin",
                so.created_at as "createdAt",
                u_courier.full_name as "courierName",
                u_courier.phone as "courierPhone",
                u_courier.rating_avg as "courierRating",
                cp.vehicle_type as "vehicleType",
                cp.vehicle_plate as "vehiclePlate",
                ST_Y(cp.current_location::geometry) as "courierLat",
                ST_X(cp.current_location::geometry) as "courierLng",
                cp.current_bearing as "courierBearing"
         FROM service_orders so
         LEFT JOIN users u_courier ON so.courier_id = u_courier.id
         LEFT JOIN courier_profiles cp ON u_courier.id = cp.user_id
         WHERE so.client_id = $1 AND so.status NOT IN ('COMPLETED', 'CANCELLED')
         ORDER BY so.created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (res.rows.length === 0) return null;
      const r = res.rows[0];

      // Si está en SEARCHING, traer las ofertas que le han llegado
      let bids: any[] = [];
      if (r.status === 'SEARCHING') {
        const bidsRes = await db.query(
          `SELECT ob.id as "bidId", ob.courier_id as "courierId", ob.bid_amount as "bidAmount",
                  ob.eta_minutes as "etaMinutes", u.full_name as "courierName",
                  u.rating_avg as "courierRating", cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate"
           FROM order_bids ob
           JOIN users u ON ob.courier_id = u.id
           JOIN courier_profiles cp ON u.id = cp.user_id
           WHERE ob.order_id = $1 AND ob.status = 'PENDING'`,
          [r.id]
        );
        bids = bidsRes.rows.map((b: any) => ({
          bidId: b.bidId,
          courierId: b.courierId,
          bidAmount: Number(b.bidAmount),
          etaMinutes: Number(b.etaMinutes || 10),
          courierName: b.courierName,
          courierRating: Number(b.courierRating || 5.0),
          vehicleType: b.vehicleType,
          vehiclePlate: b.vehiclePlate,
        }));
      }

      return {
        order: {
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
        },
        courier: r.courierId ? {
          id: r.courierId,
          fullName: r.courierName,
          phone: r.courierPhone,
          ratingAvg: Number(r.courierRating || 5.0),
          vehicleType: r.vehicleType,
          vehiclePlate: r.vehiclePlate,
          currentLocation: r.courierLat && r.courierLng ? {
            latitude: Number(r.courierLat),
            longitude: Number(r.courierLng),
            bearing: Number(r.courierBearing || 0),
          } : null,
        } : null,
        bids,
      };
    } else {
      // Conductor: órdenes activas asignadas
      const res = await db.query(
        `SELECT so.id, so.client_id as "clientId", so.courier_id as "courierId",
                so.service_type as "serviceType", so.status,
                so.origin_address as "originAddress",
                ST_Y(so.origin_point::geometry) as "originLat",
                ST_X(so.origin_point::geometry) as "originLng",
                so.destination_address as "destinationAddress",
                ST_Y(so.destination_point::geometry) as "destLat",
                ST_X(so.destination_point::geometry) as "destLng",
                so.description_notes as "descriptionNotes",
                so.estimated_purchase_cost as "estimatedPurchaseCost",
                so.offered_price as "offeredPrice",
                so.agreed_price as "agreedPrice",
                so.commission_amount as "commissionAmount",
                so.created_at as "createdAt",
                u_client.full_name as "clientName",
                u_client.phone as "clientPhone"
         FROM service_orders so
         JOIN users u_client ON so.client_id = u_client.id
         WHERE so.courier_id = $1 AND so.status IN ('ACCEPTED', 'ARRIVED_AT_ORIGIN', 'PURCHASING', 'PICKED_UP', 'IN_TRANSIT')
         ORDER BY so.created_at ASC`,
        [userId]
      );

      return res.rows.map((r: any) => ({
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
        createdAt: r.createdAt,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
      }));
    }
  },

  async getMyOrderHistory(userId: string, role: string) {
    const isCourier = role === 'COURIER';
    const query = `
      SELECT so.id, so.service_type as "serviceType", so.status,
             so.origin_address as "originAddress", so.destination_address as "destinationAddress",
             COALESCE(so.agreed_price, so.offered_price) as price,
             so.commission_amount as "commissionAmount",
             ${isCourier ? 'NULL' : 'so.delivery_pin'} as "deliveryPin",
             so.created_at as "createdAt", so.completed_at as "completedAt",
             u_client.full_name as "clientName",
             u_courier.full_name as "courierName",
             cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate",
             rating_received.score as "ratingReceived",
             rating_received.comment as "commentReceived"
      FROM service_orders so
      JOIN users u_client ON so.client_id = u_client.id
      LEFT JOIN users u_courier ON so.courier_id = u_courier.id
      LEFT JOIN courier_profiles cp ON u_courier.id = cp.user_id
      LEFT JOIN order_ratings rating_received ON rating_received.order_id = so.id AND rating_received.rated_id = $1
      WHERE ${isCourier ? 'so.courier_id = $1' : 'so.client_id = $1'}
      ORDER BY so.created_at DESC
      LIMIT 50
    `;

    const res = await db.query(query, [userId]);
    return res.rows.map((r: any) => ({
      id: r.id,
      serviceType: r.serviceType,
      status: r.status,
      originAddress: r.originAddress,
      destinationAddress: r.destinationAddress,
      price: Number(r.price),
      commissionAmount: Number(r.commissionAmount || 0),
      deliveryPin: isCourier ? undefined : r.deliveryPin,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      counterpartName: isCourier ? r.clientName : (r.courierName || 'Pendiente'),
      vehicleType: r.vehicleType,
      vehiclePlate: r.vehiclePlate,
      ratingReceived: r.ratingReceived ? Number(r.ratingReceived) : null,
      commentReceived: r.commentReceived || null,
    }));
  },

  async rateOrder(raterId: string, orderId: string, score: number, comment?: string, feedbackTags?: string[]) {
    if (score < 1 || score > 5) {
      throw new Error('La calificación debe estar entre 1 y 5 estrellas');
    }

    const orderRes = await db.query(
      `SELECT client_id as "clientId", courier_id as "courierId", status FROM service_orders WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderRes.rows[0];
    if (order.status !== 'COMPLETED') {
      throw new Error('Solo se pueden calificar servicios completados');
    }

    let ratedId: string;
    if (order.clientId === raterId) {
      if (!order.courierId) throw new Error('No hay conductor asignado');
      ratedId = order.courierId;
    } else if (order.courierId === raterId) {
      ratedId = order.clientId;
    } else {
      throw new Error('No estás autorizado para calificar este servicio');
    }

    // Insertar o actualizar calificación
    await db.query(
      `INSERT INTO order_ratings (order_id, rater_id, rated_id, score, comment, feedback_tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (order_id, rater_id)
       DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, feedback_tags = EXCLUDED.feedback_tags`,
      [orderId, raterId, ratedId, score, comment || null, feedbackTags || []]
    );

    // Recalcular promedio de estrellas
    const statsRes = await db.query(
      `SELECT AVG(score) as "avgScore", COUNT(id) as "totalCount"
       FROM order_ratings WHERE rated_id = $1`,
      [ratedId]
    );

    const avg = Number(statsRes.rows[0].avgScore || 5.0).toFixed(2);
    const count = Number(statsRes.rows[0].totalCount || 1);

    await db.query(
      `UPDATE users SET rating_avg = $1, rating_count = $2 WHERE id = $3`,
      [avg, count, ratedId]
    );

    return {
      success: true,
      score,
      ratedId,
      message: '¡Calificación registrada exitosamente!',
    };
  },

  async createPqrTicket(reporterId: string, orderId: string, category: string, description: string) {
    if (!description || description.trim().length < 5) {
      throw new Error('Por favor detalla la descripción del incidente (mínimo 5 caracteres)');
    }

    const orderRes = await db.query(
      `SELECT client_id as "clientId", courier_id as "courierId" FROM service_orders WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderRes.rows[0];
    let reportedUserId: string;
    if (order.clientId === reporterId) {
      if (!order.courierId) throw new Error('No hay conductor asignado a este servicio');
      reportedUserId = order.courierId;
    } else if (order.courierId === reporterId) {
      reportedUserId = order.clientId;
    } else {
      throw new Error('No estás autorizado para reportar incidencias sobre esta orden');
    }

    const validCategories = [
      'UNCOMPLETED_DELIVERY',
      'DAMAGE_OR_LOSS',
      'PRICE_DISPUTE',
      'INAPPROPRIATE_BEHAVIOR',
      'SECURITY_CONCERN',
      'OTHER',
    ];

    const safeCategory = validCategories.includes(category) ? category : 'OTHER';

    const res = await db.query(
      `INSERT INTO pqr_tickets (order_id, reporter_id, reported_user_id, category, description, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN')
       RETURNING id, category, status, created_at as "createdAt"`,
      [orderId, reporterId, reportedUserId, safeCategory, description]
    );

    return {
      ticketId: res.rows[0].id,
      category: res.rows[0].category,
      status: res.rows[0].status,
      message: 'Ticket de PQR radicado con éxito. Nuestro equipo de seguridad y soporte lo atenderá.',
    };
  },

  async getPublicTrackingInfo(orderId: string) {
    const query = `
      SELECT so.id, so.service_type as "serviceType", so.status,
             so.origin_address as "originAddress",
             ST_Y(so.origin_point::geometry) as "originLat", ST_X(so.origin_point::geometry) as "originLng",
             so.destination_address as "destinationAddress",
             ST_Y(so.destination_point::geometry) as "destLat", ST_X(so.destination_point::geometry) as "destLng",
             so.agreed_price as "agreedPrice", so.created_at as "createdAt",
             u.full_name as "courierFullName", u.rating_avg as "ratingAvg",
             cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate",
             ST_Y(cp.current_location::geometry) as "courierLat", ST_X(cp.current_location::geometry) as "courierLng",
             cp.current_bearing as "courierBearing"
      FROM service_orders so
      LEFT JOIN users u ON so.courier_id = u.id
      LEFT JOIN courier_profiles cp ON u.id = cp.user_id
      WHERE so.id = $1
    `;

    const res = await db.query(query, [orderId]);
    if (res.rows.length === 0) {
      throw new Error('Servicio no encontrado');
    }

    const r = res.rows[0];
    return {
      orderId: r.id,
      serviceType: r.serviceType,
      status: r.status,
      originAddress: r.originAddress,
      originPoint: { latitude: Number(r.originLat), longitude: Number(r.originLng) },
      destinationAddress: r.destinationAddress,
      destinationPoint: { latitude: Number(r.destLat), longitude: Number(r.destLng) },
      agreedPrice: Number(r.agreedPrice || 0),
      createdAt: r.createdAt,
      courier: r.courierFullName ? {
        firstName: r.courierFullName.split(' ')[0],
        ratingAvg: Number(r.ratingAvg || 5.0),
        vehicleType: r.vehicleType,
        vehiclePlate: r.vehiclePlate,
        location: r.courierLat ? {
          latitude: Number(r.courierLat),
          longitude: Number(r.courierLng),
          bearing: Number(r.courierBearing || 0),
        } : null,
      } : null,
    };
  },

  async updateCourierLocation(
    courierUserId: string,
    coords: { latitude: number; longitude: number; bearing?: number; speed?: number; activeOrderIds?: string[] }
  ) {
    await db.query(
      `UPDATE courier_profiles
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
           current_bearing = $3,
           last_ping_at = NOW()
       WHERE user_id = $4`,
      [coords.longitude, coords.latitude, coords.bearing || 0, courierUserId]
    );

    const ordersRes = await db.query(
      `SELECT id, client_id as "clientId"
       FROM service_orders
       WHERE courier_id = $1
         AND status IN ('ACCEPTED', 'ARRIVED_AT_ORIGIN', 'PURCHASING', 'PICKED_UP', 'IN_TRANSIT')`,
      [courierUserId]
    );

    const orderIds = new Set<string>(ordersRes.rows.map((r: any) => r.id));
    if (coords.activeOrderIds && Array.isArray(coords.activeOrderIds)) {
      coords.activeOrderIds.forEach((id: string) => orderIds.add(id));
    }

    for (const orderId of orderIds) {
      const clientRow = ordersRes.rows.find((r: any) => r.id === orderId);
      socketEvents.emitLocationFeed(
        orderId,
        {
          orderId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          bearing: coords.bearing || 0,
        },
        clientRow?.clientId
      );
    }

    return { success: true, updatedOrdersCount: orderIds.size };
  },

  async getCourierRatings(courierUserId: string) {
    const userRes = await db.query(
      `SELECT rating_avg as "ratingAvg", rating_count as "ratingCount" FROM users WHERE id = $1`,
      [courierUserId]
    );

    const ratingsRes = await db.query(
      `SELECT r.id, r.score, r.feedback_tags as "feedbackTags", r.comment, r.created_at as "createdAt",
              so.service_type as "serviceType"
       FROM order_ratings r
       JOIN service_orders so ON r.order_id = so.id
       WHERE r.rated_id = $1
       ORDER BY r.created_at DESC
       LIMIT 60`,
      [courierUserId]
    );

    const breakdown: { [score: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingsRes.rows.forEach((r: any) => {
      const s = Number(r.score) || 5;
      if (breakdown[s] !== undefined) {
        breakdown[s]++;
      }
    });

    return {
      averageRating: Number(userRes.rows[0]?.ratingAvg || 5.0),
      totalRatings: Number(userRes.rows[0]?.ratingCount || ratingsRes.rows.length),
      breakdown,
      ratings: ratingsRes.rows.map((r: any) => ({
        id: r.id,
        score: Number(r.score),
        feedbackTags: r.feedbackTags || [],
        comment: r.comment || '',
        serviceType: r.serviceType,
        createdAt: r.createdAt,
      })),
    };
  },
};



