import {
  loginSchema,
  registerClientSchema,
  createOrderSchema,
  verifyOtpSchema,
  createTopupRequestSchema,
} from '../schemas';

describe('Shared Schemas Validation Suite', () => {
  describe('loginSchema', () => {
    it('debe validar un teléfono correcto y contraseña válida', () => {
      const valid = { phone: '3001234567', password: 'password123' };
      expect(loginSchema.safeParse(valid).success).toBe(true);
    });

    it('debe rechazar teléfonos inválidos', () => {
      const invalid = { phone: '123', password: 'password123' };
      expect(loginSchema.safeParse(invalid).success).toBe(false);
    });

    it('debe rechazar contraseñas cortas', () => {
      const invalid = { phone: '3001234567', password: '123' };
      expect(loginSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('registerClientSchema', () => {
    it('debe requerir la aceptación expresa de Términos y Condiciones', () => {
      const payload = {
        fullName: 'Juan Pérez',
        phone: '3109876543',
        password: 'securePass123',
        termsAccepted: false,
      };
      const result = registerClientSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('debe aprobar registro con términos aceptados', () => {
      const payload = {
        fullName: 'Juan Pérez',
        phone: '3109876543',
        password: 'securePass123',
        termsAccepted: true,
      };
      const result = registerClientSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('createOrderSchema', () => {
    it('debe validar una orden de domicilio correctamente', () => {
      const order = {
        serviceType: 'DELIVERY',
        originAddress: 'Calle 10 # 40-20, Poblado',
        originPoint: { latitude: 6.2085, longitude: -75.5678 },
        destinationAddress: 'Carrera 43A # 1-50, San Fernando',
        destinationPoint: { latitude: 6.2012, longitude: -75.5721 },
        offeredPrice: 8000,
        descriptionNotes: 'Paquete pequeño con documentos',
      };
      expect(createOrderSchema.safeParse(order).success).toBe(true);
    });

    it('debe rechazar tarifas por debajo del mínimo ($1.000 COP)', () => {
      const order = {
        serviceType: 'DELIVERY',
        originAddress: 'Calle 10',
        originPoint: { latitude: 6.2, longitude: -75.5 },
        destinationAddress: 'Carrera 43',
        destinationPoint: { latitude: 6.21, longitude: -75.51 },
        offeredPrice: 500,
      };
      expect(createOrderSchema.safeParse(order).success).toBe(false);
    });
  });

  describe('verifyOtpSchema', () => {
    it('debe aceptar exactamente 4 dígitos numéricos', () => {
      const valid = { orderId: '123e4567-e89b-12d3-a456-426614174000', pin: '4821' };
      expect(verifyOtpSchema.safeParse(valid).success).toBe(true);
    });

    it('debe rechazar PIN con letras o longitud distinta', () => {
      const invalidChars = { orderId: '123e4567-e89b-12d3-a456-426614174000', pin: '48A1' };
      const invalidLength = { orderId: '123e4567-e89b-12d3-a456-426614174000', pin: '482' };
      expect(verifyOtpSchema.safeParse(invalidChars).success).toBe(false);
      expect(verifyOtpSchema.safeParse(invalidLength).success).toBe(false);
    });
  });

  describe('createTopupRequestSchema', () => {
    it('debe requerir un monto mínimo de $5.000 COP y método válido', () => {
      const valid = {
        amount: 20000,
        paymentMethod: 'NEQUI',
        referenceNumber: 'TRX-987654321',
        voucherUrl: 'https://storage.midominio.com/vouchers/v1.png',
      };
      expect(createTopupRequestSchema.safeParse(valid).success).toBe(true);
    });

    it('debe rechazar montos inferiores a $5.000 COP', () => {
      const invalid = {
        amount: 2000,
        paymentMethod: 'DAVIPLATA',
        referenceNumber: 'TRX-123',
        voucherUrl: 'https://storage.midominio.com/vouchers/v1.png',
      };
      expect(createTopupRequestSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
