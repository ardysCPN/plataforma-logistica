import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Cargar variables de entorno desde .env si existe en la raíz o en el workspace
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.SERVER_PORT || process.env.PORT || '3001',
  SERVER_HOST: process.env.SERVER_HOST || '0.0.0.0',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // PostgreSQL + PostGIS (Soporta DATABASE_URL o variables individuales tipo POSTGRES_* / DB_*)
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.POSTGRES_PORT || process.env.DB_PORT || '5432',
  DB_USER: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres123',
  DB_NAME: process.env.POSTGRES_DB || process.env.DB_NAME || 'plataforma_logistica',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || '6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'adh_solutions_secret_jwt_key_2026_prod!',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Ruteo y Geocodificación
  OSRM_URL: process.env.OSRM_URL || 'http://router.project-osrm.org',
  NOMINATIM_URL: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',

  // Archivos KYC
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB || '5',
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  SERVER_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres123'),
  DB_NAME: z.string().default('plataforma_logistica'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional().default(''),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  OSRM_URL: z.string().url().default('http://router.project-osrm.org'),
  NOMINATIM_URL: z.string().url().default('https://nominatim.openstreetmap.org'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('5'),
});

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('❌ Error de validación en variables de entorno:', parsed.error.format());
  throw new Error('Configuración de entorno inválida');
}

export const env = parsed.data;
