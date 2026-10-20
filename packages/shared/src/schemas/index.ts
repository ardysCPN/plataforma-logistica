import { z } from 'zod';

// Expresión regular para teléfonos (formato móvil estándar de 10 dígitos o internacional)
const phoneRegex = /^\+?[0-9]{10,14}$/;

// 1. Autenticación y Registro
export const loginSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Número telefónico inválido (10 a 14 dígitos)'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerClientSchema = z.object({
  fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  phone: z.string().regex(phoneRegex, 'Número telefónico inválido'),
  email: z.string().email('Correo electrónico inválido').optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los Términos y Condiciones y la Política de Datos' }),
  }),
  deviceHash: z.string().optional(),
});
export type RegisterClientInput = z.infer<typeof registerClientSchema>;

export const registerCourierSchema = z.object({
  fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  phone: z.string().regex(phoneRegex, 'Número telefónico inválido'),
  email: z.string().email('Correo electrónico inválido').optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  vehicleType: z.enum(['MOTO', 'CAR', 'BICYCLE']),
  vehiclePlate: z.string().max(15).optional().nullable(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los Términos y Condiciones y la Política de Datos' }),
  }),
  deviceHash: z.string().optional(),
});
export type RegisterCourierInput = z.infer<typeof registerCourierSchema>;

// 2. GeoPoint Schema
export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// 3. Creación de Órdenes de Servicio
export const createOrderSchema = z.object({
  serviceType: z.enum(['DELIVERY', 'ERRAND', 'TRANSPORT']),
  originAddress: z.string().min(3, 'La dirección de origen es requerida'),
  originPoint: geoPointSchema,
  destinationAddress: z.string().min(3, 'La dirección de destino es requerida'),
  destinationPoint: geoPointSchema,
  descriptionNotes: z.string().max(1000).optional().nullable(),
  estimatedPurchaseCost: z.number().min(0).default(0),
  offeredPrice: z.number().min(1000, 'La tarifa mínima de oferta es $1.000 COP'),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// 4. Subasta y Ofertas
export const createBidSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
  bidAmount: z.number().min(1000, 'El valor ofertado debe ser mayor a $1.000 COP'),
  etaMinutes: z.number().int().min(1).max(120).optional().nullable(),
});
export type CreateBidInput = z.infer<typeof createBidSchema>;

export const acceptBidSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
  bidId: z.string().uuid('ID de oferta inválido'),
});
export type AcceptBidInput = z.infer<typeof acceptBidSchema>;

// 5. Cierre con PIN OTP
export const verifyOtpSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
  pin: z.string().length(4, 'El código PIN debe ser exactamente de 4 dígitos').regex(/^[0-9]{4}$/, 'El PIN debe ser numérico'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// 6. Chat en Tiempo Real
export const sendChatMessageSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
  messageType: z.enum(['TEXT', 'IMAGE', 'QUICK_NOTE']).default('TEXT'),
  content: z.string().min(1, 'El mensaje no puede estar vacío').max(1000),
  imageUrl: z.string().url().optional().nullable(),
});
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

// 7. Billetera y Recargas
export const createTopupRequestSchema = z.object({
  amount: z.number().min(5000, 'El monto mínimo de recarga es $5.000 COP'),
  paymentMethod: z.enum(['NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_QR', 'CASH_OFFICE']),
  referenceNumber: z.string().min(3, 'El número de comprobante es requerido').max(80),
  voucherUrl: z.string().min(1, 'El comprobante fotográfico es requerido'),
});
export type CreateTopupRequestInput = z.infer<typeof createTopupRequestSchema>;

export const reviewTopupSchema = z.object({
  topupId: z.string().uuid('ID de solicitud inválido'),
  approved: z.boolean(),
  rejectionReason: z.string().max(255).optional().nullable(),
});
export type ReviewTopupInput = z.infer<typeof reviewTopupSchema>;

// 8. Calificaciones
export const createRatingSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
  score: z.number().int().min(1).max(5),
  feedbackTags: z.array(z.string()).max(5).optional().nullable(),
  comment: z.string().max(500).optional().nullable(),
});
export type CreateRatingInput = z.infer<typeof createRatingSchema>;

// 9. PQR e Incidentes
export const createPQRSchema = z.object({
  orderId: z.string().uuid('ID de orden inválido'),
  reportedUserId: z.string().uuid('ID de usuario reportado inválido'),
  category: z.enum([
    'UNCOMPLETED_DELIVERY',
    'DAMAGE_OR_LOSS',
    'PRICE_DISPUTE',
    'INAPPROPRIATE_BEHAVIOR',
    'SECURITY_CONCERN',
    'OTHER',
  ]),
  description: z.string().min(10, 'Por favor detalla el incidente (al menos 10 caracteres)').max(2000),
  evidenceUrls: z.array(z.string().url()).max(5).optional().nullable(),
});
export type CreatePQRInput = z.infer<typeof createPQRSchema>;
