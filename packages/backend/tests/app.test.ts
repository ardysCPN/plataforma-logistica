import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/config/database';
import * as redisConfig from '../src/config/redis';

describe('Backend App & Health Check Suite', () => {
  it('debe responder 200 en la ruta raíz con metadatos del servicio', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Plataforma Logística API');
    expect(res.body).toHaveProperty('version');
  });

  it('debe responder 404 en rutas desconocidas', async () => {
    const res = await request(app).get('/ruta-inexistente');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Ruta no encontrada');
  });

  it('debe responder en la ruta /health informando el estado de servicios', async () => {
    jest.spyOn(db, 'checkConnection').mockResolvedValueOnce({ connected: false, error: 'Offline in test' });
    jest.spyOn(redisConfig, 'checkRedisConnection').mockResolvedValueOnce({ connected: false, error: 'Offline in test' });

    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
    expect(res.body.services).toHaveProperty('redis');
  });
});
