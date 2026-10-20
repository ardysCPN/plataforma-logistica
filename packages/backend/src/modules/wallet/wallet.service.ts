import { db } from '../../config/database';
import { CreateTopupRequestInput, TopupRequest, WalletTransaction } from '@plataforma/shared';

export const walletService = {
  async requestTopup(courierId: string, input: CreateTopupRequestInput): Promise<TopupRequest> {
    const res = await db.query<TopupRequest>(
      `INSERT INTO topup_requests (courier_id, amount, payment_method, reference_number, voucher_url, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, courier_id as "courierId", amount, payment_method as "paymentMethod",
                 reference_number as "referenceNumber", voucher_url as "voucherUrl",
                 status, created_at as "createdAt"`,
      [courierId, input.amount, input.paymentMethod, input.referenceNumber, input.voucherUrl]
    );

    return res.rows[0];
  },

  async reviewTopup(adminId: string, topupId: string, approve: boolean, rejectionReason?: string) {
    return db.transaction(async (client) => {
      // 1. Bloquear registro de solicitud
      const topupRes = await client.query(
        `SELECT id, courier_id as "courierId", amount, status
         FROM topup_requests
         WHERE id = $1 FOR UPDATE`,
        [topupId]
      );

      if (topupRes.rows.length === 0) {
        throw new Error('Solicitud de recarga no encontrada');
      }

      const topup = topupRes.rows[0];
      if (topup.status !== 'PENDING') {
        throw new Error(`Esta solicitud ya fue procesada previamente con estado: ${topup.status}`);
      }

      if (!approve) {
        await client.query(
          `UPDATE topup_requests
           SET status = 'REJECTED', admin_id = $1, rejection_reason = $2, processed_at = NOW()
           WHERE id = $3`,
          [adminId, rejectionReason || 'Comprobante no válido', topupId]
        );
        return { topupId, status: 'REJECTED', message: 'Solicitud rechazada' };
      }

      // 2. Aprobar e incrementar saldo
      const courierRes = await client.query(
        `SELECT id, wallet_balance as "walletBalance" FROM users WHERE id = $1 FOR UPDATE`,
        [topup.courierId]
      );

      const currentBalance = Number(courierRes.rows[0].walletBalance);
      const topupAmount = Number(topup.amount);
      const newBalance = currentBalance + topupAmount;

      await client.query(
        `UPDATE users SET wallet_balance = $1 WHERE id = $2`,
        [newBalance, topup.courierId]
      );

      await client.query(
        `UPDATE topup_requests
         SET status = 'APPROVED', admin_id = $1, processed_at = NOW()
         WHERE id = $2`,
        [adminId, topupId]
      );

      await client.query(
        `INSERT INTO wallet_transactions (courier_id, topup_id, admin_id, tx_type, amount, balance_after, notes)
         VALUES ($1, $2, $3, 'TOPUP_CREDIT', $4, $5, $6)`,
        [
          topup.courierId,
          topupId,
          adminId,
          topupAmount,
          newBalance,
          `Recarga aprobada por Administrador - Ref #${topupId.substring(0, 8)}`,
        ]
      );

      return {
        topupId,
        status: 'APPROVED',
        courierId: topup.courierId,
        creditedAmount: topupAmount,
        newBalance,
        message: '¡Recarga aprobada y acreditada exitosamente!',
      };
    });
  },

  async getPendingTopups(): Promise<TopupRequest[]> {
    const res = await db.query(
      `SELECT tr.id, tr.courier_id as "courierId", tr.amount, tr.payment_method as "paymentMethod",
              tr.reference_number as "referenceNumber", tr.voucher_url as "voucherUrl",
              tr.status, tr.created_at as "createdAt",
              u.full_name as "courierName", u.phone as "courierPhone"
       FROM topup_requests tr
       JOIN users u ON tr.courier_id = u.id
       WHERE tr.status = 'PENDING'
       ORDER BY tr.created_at ASC`
    );

    return res.rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    })) as unknown as TopupRequest[];
  },

  async getCourierWallet(courierId: string): Promise<{ balance: number; transactions: WalletTransaction[] }> {
    const userRes = await db.query(
      `SELECT wallet_balance as "walletBalance" FROM users WHERE id = $1`,
      [courierId]
    );

    const balance = userRes.rows.length > 0 ? Number(userRes.rows[0].walletBalance) : 0;

    const txRes = await db.query(
      `SELECT id, courier_id as "courierId", order_id as "orderId", topup_id as "topupId",
              tx_type as "txType", amount, balance_after as "balanceAfter", notes, created_at as "createdAt"
       FROM wallet_transactions
       WHERE courier_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [courierId]
    );

    return {
      balance,
      transactions: txRes.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
        balanceAfter: Number(r.balanceAfter),
      })) as unknown as WalletTransaction[],
    };
  },
};
