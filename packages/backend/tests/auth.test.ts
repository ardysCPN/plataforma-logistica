import request from 'supertest';
import { app } from '../src/app';

describe('Auth & Legal Acceptance API Endpoints', () => {
  it('debe rechazar registro de cliente si no acepta los términos legales', async () => {
    const res = await request(app)
      .post('/api/auth/register/client')
      .send({
        fullName: 'Carlos Rodriguez',
        phone: '3001112233',
        email: 'carlos@example.com',
        password: 'password123',
        termsAccepted: false,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Error de validación en la solicitud');
  });

  it('debe rechazar registro con teléfono no válido', async () => {
    const res = await request(app)
      .post('/api/auth/register/client')
      .send({
        fullName: 'Carlos Rodriguez',
        phone: '123',
        email: 'carlos@example.com',
        password: 'password123',
        termsAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toContain('Número telefónico inválido');
  });

  it('debe proteger la ruta /api/auth/me sin token JWT', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
