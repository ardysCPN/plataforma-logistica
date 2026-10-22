import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../config/database';
import { env } from '../../config/env';
import {
  LoginInput,
  RegisterClientInput,
  RegisterCourierInput,
  User,
  CourierProfile,
} from '@plataforma/shared';

export interface ClientAuditInfo {
  ipAddress: string;
  userAgent?: string;
  deviceHash?: string;
}

export const authService = {
  async registerClient(input: RegisterClientInput, audit: ClientAuditInfo) {
    const existing = await db.query('SELECT id FROM users WHERE phone = $1', [input.phone]);
    if (existing.rows.length > 0) {
      throw new Error('El número telefónico ya se encuentra registrado');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return db.transaction(async (client) => {
      const userRes = await client.query<User>(
        `INSERT INTO users (role, full_name, phone, email, avatar_url, password_hash, status)
         VALUES ('CLIENT', $1, $2, $3, $4, $5, 'ACTIVE')
         RETURNING id, role, full_name as "fullName", phone, email, avatar_url as "avatarUrl", status, rating_avg as "ratingAvg", rating_count as "ratingCount", wallet_balance as "walletBalance", created_at as "createdAt", updated_at as "updatedAt"`,
        [input.fullName, input.phone, input.email || null, input.avatarUrl || null, passwordHash]
      );
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO legal_acceptances (user_id, terms_version, ip_address, user_agent, device_hash, clause_acknowledged)
         VALUES ($1, '1.0', $2, $3, $4, TRUE)`,
        [user.id, audit.ipAddress, audit.userAgent || null, input.deviceHash || audit.deviceHash || null]
      );

      const token = jwt.sign(
        { id: user.id, role: user.role, status: user.status },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
      );

      return { user, token };
    });
  },

  async registerCourier(input: RegisterCourierInput, audit: ClientAuditInfo) {
    const existing = await db.query('SELECT id FROM users WHERE phone = $1', [input.phone]);
    if (existing.rows.length > 0) {
      throw new Error('El número telefónico ya se encuentra registrado');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return db.transaction(async (client) => {
      const userRes = await client.query<User>(
        `INSERT INTO users (role, full_name, phone, email, avatar_url, password_hash, status)
         VALUES ('COURIER', $1, $2, $3, $4, $5, 'PENDING_APPROVAL')
         RETURNING id, role, full_name as "fullName", phone, email, avatar_url as "avatarUrl", status, rating_avg as "ratingAvg", rating_count as "ratingCount", wallet_balance as "walletBalance", created_at as "createdAt", updated_at as "updatedAt"`,
        [input.fullName, input.phone, input.email || null, input.avatarUrl || null, passwordHash]
      );
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO courier_profiles (user_id, vehicle_type, vehicle_plate, vehicle_model, vehicle_color, id_card_front_url, id_card_back_url, selfie_url)
         VALUES ($1, $2, $3, $4, $5, '', '', '')`,
        [user.id, input.vehicleType, input.vehiclePlate || null, input.vehicleModel || null, input.vehicleColor || null]
      );

      await client.query(
        `INSERT INTO legal_acceptances (user_id, terms_version, ip_address, user_agent, device_hash, clause_acknowledged)
         VALUES ($1, '1.0', $2, $3, $4, TRUE)`,
        [user.id, audit.ipAddress, audit.userAgent || null, input.deviceHash || audit.deviceHash || null]
      );

      const token = jwt.sign(
        { id: user.id, role: user.role, status: user.status },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
      );

      return { user, token };
    });
  },

  async login(input: LoginInput) {
    const res = await db.query(
      `SELECT id, role, full_name as "fullName", phone, email, avatar_url as "avatarUrl", password_hash, status, rating_avg as "ratingAvg", rating_count as "ratingCount", wallet_balance as "walletBalance", created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE phone = $1`,
      [input.phone]
    );

    if (res.rows.length === 0) {
      throw new Error('Credenciales inválidas');
    }

    const row = res.rows[0];
    const passwordMatch = await bcrypt.compare(input.password, row.password_hash);
    if (!passwordMatch) {
      throw new Error('Credenciales inválidas');
    }

    if (row.status === 'BLOCKED') {
      throw new Error('Tu cuenta ha sido bloqueada. Contacta a soporte.');
    }

    const { password_hash, ...user } = row;
    const token = jwt.sign(
      { id: user.id, role: user.role, status: user.status },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return { user: user as User, token };
  },

  async getMe(userId: string) {
    const userRes = await db.query<User>(
      `SELECT id, role, full_name as "fullName", phone, email, avatar_url as "avatarUrl", status, rating_avg as "ratingAvg", rating_count as "ratingCount", wallet_balance as "walletBalance", created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const user = userRes.rows[0];
    let profile: CourierProfile | null = null;

    if (user.role === 'COURIER') {
      const profRes = await db.query(
        `SELECT user_id as "userId", vehicle_type as "vehicleType", vehicle_plate as "vehiclePlate",
                vehicle_model as "vehicleModel", vehicle_color as "vehicleColor",
                id_card_front_url as "idCardFrontUrl", id_card_back_url as "idCardBackUrl",
                selfie_url as "selfieUrl", vehicle_doc_url as "vehicleDocUrl", is_online as "isOnline",
                active_orders_count as "activeOrdersCount", current_bearing as "currentBearing", last_ping_at as "lastPingAt"
         FROM courier_profiles WHERE user_id = $1`,
        [userId]
      );
      if (profRes.rows.length > 0) {
        profile = profRes.rows[0] as unknown as CourierProfile;
      }
    }

    return { user, profile };
  },

  async updateAvatar(userId: string, avatarUrl: string) {
    const res = await db.query<User>(
      `UPDATE users
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, role, full_name as "fullName", phone, email, avatar_url as "avatarUrl", status, rating_avg as "ratingAvg", rating_count as "ratingCount", wallet_balance as "walletBalance", created_at as "createdAt", updated_at as "updatedAt"`,
      [avatarUrl, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    return res.rows[0];
  },

  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      email?: string;
      vehicleType?: any;
      vehiclePlate?: string;
      vehicleModel?: string;
      vehicleColor?: string;
    }
  ) {
    const user = await db.transaction(async (client) => {
      const userRes = await client.query<User>(
        `UPDATE users
         SET full_name = COALESCE($1, full_name),
             email = COALESCE($2, email),
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, role, full_name as "fullName", phone, email, avatar_url as "avatarUrl", status, rating_avg as "ratingAvg", rating_count as "ratingCount", wallet_balance as "walletBalance", created_at as "createdAt", updated_at as "updatedAt"`,
        [data.fullName || null, data.email || null, userId]
      );

      if (userRes.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      if (userRes.rows[0].role === 'COURIER') {
        await client.query(
          `UPDATE courier_profiles
           SET vehicle_type = COALESCE($1, vehicle_type),
               vehicle_plate = COALESCE($2, vehicle_plate),
               vehicle_model = COALESCE($3, vehicle_model),
               vehicle_color = COALESCE($4, vehicle_color)
           WHERE user_id = $5`,
          [
            data.vehicleType || null,
            data.vehiclePlate || null,
            data.vehicleModel || null,
            data.vehicleColor || null,
            userId,
          ]
        );
      }

      return userRes.rows[0];
    });

    return this.getMe(user.id);
  },

  async getPublicCourier(courierId: string) {
    const res = await db.query(
      `SELECT u.id, u.full_name as "fullName", u.rating_avg as "ratingAvg", u.rating_count as "ratingCount",
              u.avatar_url as "avatarUrl", cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate",
              cp.vehicle_model as "vehicleModel", cp.vehicle_color as "vehicleColor"
       FROM users u
       JOIN courier_profiles cp ON u.id = cp.user_id
       WHERE u.id = $1`,
      [courierId]
    );

    if (res.rows.length === 0) {
      throw new Error('Conductor no encontrado');
    }

    return res.rows[0];
  },
};
