import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './config/database';
import { checkRedisConnection } from './config/redis';

export const app = express();

// Middlewares de Seguridad y Parsing
app.use(helmet());
app.use(cors({
  origin: '*', // Permite Expo Web y APK Móvil
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const dbStatus = await db.checkConnection();
  const redisStatus = await checkRedisConnection();

  const isHealthy = dbStatus.connected; // PostGIS es obligatorio para operar

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
});

// Ruta raíz informativa
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Plataforma Logística API',
    version: '1.0.0',
    documentation: 'Especificación SDD en /agent.md',
  });
});

// Manejador de 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware Global de Manejo de Errores
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error no controlado en la aplicación:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});
