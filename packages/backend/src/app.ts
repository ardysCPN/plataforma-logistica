import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import { db } from './config/database';
import { checkRedisConnection } from './config/redis';

// Rutas de Módulos
import { authRouter } from './modules/auth/auth.routes';
import { kycRouter } from './modules/kyc/kyc.routes';
import { orderRouter } from './modules/services/order.routes';
import { biddingRouter } from './modules/bidding/bidding.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { walletRouter } from './modules/wallet/wallet.routes';

export const app = express();

// Middlewares de Seguridad y Parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servidor de Archivos Estáticos para Comprobantes y KYC
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// Endpoints Base y Health Check
app.get('/health', async (_req: Request, res: Response) => {
  const dbStatus = await db.checkConnection();
  const redisStatus = await checkRedisConnection();
  const isHealthy = dbStatus.connected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Plataforma Logística API',
    version: '1.0.8',
    documentation: 'Especificación SDD en /agent.md',
  });
});

app.get('/api/version', (_req: Request, res: Response) => {
  res.json({
    latestVersion: '1.0.8',
    latestVersionCode: 9,
    minRequiredVersion: '1.0.0',
    apkDownloadUrl: 'https://domiapp.adhsolutions.tech/downloads/domy.apk',
    releaseNotes: 'Mapas nítidos de alta definición sin requerimiento de API Key, plataforma 100% en español colombiano (Mandados, Encomiendas, Transporte), prevención de cierres inesperados por memoria y traducción clara de errores de conexión.',
    releaseDate: '2026-10-24',
  });
});

// Montaje de Rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/orders', orderRouter);
app.use('/api/bids', biddingRouter);
app.use('/api/chat', chatRouter);
app.use('/api/wallet', walletRouter);

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
