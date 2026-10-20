import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from '../../config/database';
import { env } from '../../config/env';

const uploadDir = path.resolve(env.UPLOAD_DIR, 'kyc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const uploadKyc = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (PNG, JPG, WEBP)'));
    }
  },
});

export const kycService = {
  async updateDocuments(
    userId: string,
    files: { [fieldname: string]: Express.Multer.File[] }
  ) {
    const frontUrl = files['idCardFront'] ? `/uploads/kyc/${files['idCardFront'][0].filename}` : null;
    const backUrl = files['idCardBack'] ? `/uploads/kyc/${files['idCardBack'][0].filename}` : null;
    const selfieUrl = files['selfie'] ? `/uploads/kyc/${files['selfie'][0].filename}` : null;
    const vehicleDocUrl = files['vehicleDoc'] ? `/uploads/kyc/${files['vehicleDoc'][0].filename}` : null;

    const updates: string[] = [];
    const values: unknown[] = [userId];
    let counter = 2;

    if (frontUrl) {
      updates.push(`id_card_front_url = $${counter++}`);
      values.push(frontUrl);
    }
    if (backUrl) {
      updates.push(`id_card_back_url = $${counter++}`);
      values.push(backUrl);
    }
    if (selfieUrl) {
      updates.push(`selfie_url = $${counter++}`);
      values.push(selfieUrl);
    }
    if (vehicleDocUrl) {
      updates.push(`vehicle_doc_url = $${counter++}`);
      values.push(vehicleDocUrl);
    }

    if (updates.length === 0) {
      throw new Error('No se enviaron archivos para actualizar');
    }

    await db.query(
      `UPDATE courier_profiles SET ${updates.join(', ')} WHERE user_id = $1`,
      values
    );

    return { message: 'Documentos KYC actualizados correctamente' };
  },

  async reviewCourier(userId: string, approve: boolean, reason?: string) {
    const newStatus = approve ? 'ACTIVE' : 'SUSPENDED';
    await db.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND role = 'COURIER'`,
      [newStatus, userId]
    );

    return {
      userId,
      status: newStatus,
      message: approve ? 'Conductor aprobado exitosamente' : `Conductor rechazado: ${reason || 'Documentos no válidos'}`,
    };
  },

  async getPendingCouriers() {
    const res = await db.query(
      `SELECT u.id, u.full_name as "fullName", u.phone, u.email, u.status, u.created_at as "createdAt",
              cp.vehicle_type as "vehicleType", cp.vehicle_plate as "vehiclePlate",
              cp.id_card_front_url as "idCardFrontUrl", cp.id_card_back_url as "idCardBackUrl",
              cp.selfie_url as "selfieUrl", cp.vehicle_doc_url as "vehicleDocUrl"
       FROM users u
       JOIN courier_profiles cp ON u.id = cp.user_id
       WHERE u.role = 'COURIER' AND u.status = 'PENDING_APPROVAL'
       ORDER BY u.created_at ASC`
    );
    return res.rows;
  },
};
