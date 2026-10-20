import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => {
    // Si no estamos en producción, reintentar máximo 3 veces para evitar loops de error en desarrollo
    if (env.NODE_ENV !== 'production' && times > 3) {
      return null;
    }
    return Math.min(times * 100, 3000);
  },
});

redis.on('connect', () => {
  if (env.NODE_ENV !== 'test') {
    console.log('⚡ Conexión a Redis establecida exitosamente');
  }
});

redis.on('error', (err) => {
  if (env.NODE_ENV !== 'test') {
    console.warn('⚠️ Alerta de conexión Redis:', err.message);
  }
});

export const checkRedisConnection = async (): Promise<{ connected: boolean; error?: string }> => {
  try {
    const pong = await redis.ping();
    return { connected: pong === 'PONG' };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { connected: false, error: errorMessage };
  }
};
