/**
 * Modelos de datos y tipos TypeScript compartidos
 * Correspondientes al esquema de base de datos y flujos de negocio
 */

// Roles y Estados de Usuario
export type UserRole = 'CLIENT' | 'COURIER' | 'ADMIN';
export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
export type VehicleType = 'MOTO' | 'CAR' | 'BICYCLE';

// Tipos y Estados de Servicios / Órdenes
export type ServiceType = 'DELIVERY' | 'ERRAND' | 'TRANSPORT';

export type OrderStatus =
  | 'SEARCHING'          // Subasta o toma directa abierta
  | 'ACCEPTED'           // Conductor asignado / en camino al origen
  | 'ARRIVED_AT_ORIGIN'  // Conductor en punto de recogida o tienda
  | 'PURCHASING'         // Comprando artículos (exclusivo para Mandados)
  | 'PICKED_UP'          // Paquete recogido / Pasajero a bordo / Compras listas
  | 'IN_TRANSIT'         // En ruta hacia el destino
  | 'COMPLETED'          // Finalizado con validación de PIN OTP
  | 'CANCELLED';         // Cancelado por cliente, conductor o timeout

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

// Comunicación y Chat
export type MessageType = 'TEXT' | 'IMAGE' | 'QUICK_NOTE';

// Billetera y Recargas
export type TopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentMethod = 'NEQUI' | 'DAVIPLATA' | 'BANCOLOMBIA_QR' | 'CASH_OFFICE';
export type WalletTxType = 'TOPUP_CREDIT' | 'COMMISSION_DEDUCTION' | 'PENALTY' | 'MANUAL_ADJUSTMENT';

// PQR y Disputas
export type PQRCategory =
  | 'UNCOMPLETED_DELIVERY'
  | 'DAMAGE_OR_LOSS'
  | 'PRICE_DISPUTE'
  | 'INAPPROPRIATE_BEHAVIOR'
  | 'SECURITY_CONCERN'
  | 'OTHER';

export type PQRStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type PQRResolutionAction = 'NONE' | 'WARNING_ISSUED' | 'WALLET_REFUND' | 'TEMP_SUSPENSION' | 'PERMANENT_BAN';

// Geoespacial
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [longitude, latitude]
}

// Entidades del Sistema
export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  ratingAvg: number;
  ratingCount: number;
  walletBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegalAcceptance {
  id: string;
  userId: string;
  termsVersion: string;
  ipAddress: string;
  userAgent?: string | null;
  deviceHash?: string | null;
  clauseAcknowledged: boolean;
  acceptedAt: string;
}

export interface CourierProfile {
  userId: string;
  vehicleType: VehicleType;
  vehiclePlate?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  selfieUrl: string;
  vehicleDocUrl?: string | null;
  isOnline: boolean;
  activeOrdersCount: number;
  currentLocation?: GeoPoint | null;
  currentBearing: number;
  activeRouteCorridor?: RouteGeometry | null;
  lastPingAt: string;
}

export interface ServiceOrder {
  id: string;
  clientId: string;
  courierId?: string | null;
  serviceType: ServiceType;
  status: OrderStatus;
  originAddress: string;
  originPoint: GeoPoint;
  destinationAddress: string;
  destinationPoint: GeoPoint;
  descriptionNotes?: string | null;
  estimatedPurchaseCost: number;
  offeredPrice: number;
  agreedPrice?: number | null;
  commissionAmount: number;
  deliveryPin: string; // 4 dígitos OTP
  routeGeometry?: RouteGeometry | null;
  estimatedDistanceMeters?: number | null;
  estimatedDurationSeconds?: number | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface OrderBid {
  id: string;
  orderId: string;
  courierId: string;
  bidAmount: number;
  etaMinutes?: number | null;
  status: BidStatus;
  createdAt: string;
  courier?: {
    fullName: string;
    avatarUrl?: string | null;
    ratingAvg: number;
    ratingCount: number;
    vehicleType: VehicleType;
    vehiclePlate?: string | null;
    vehicleModel?: string | null;
    vehicleColor?: string | null;
  };
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  messageType: MessageType;
  content: string;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface TopupRequest {
  id: string;
  courierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  voucherUrl: string;
  status: TopupStatus;
  adminId?: string | null;
  rejectionReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
  courierName?: string;
  courierPhone?: string;
}

export interface WalletTransaction {
  id: string;
  courierId: string;
  orderId?: string | null;
  topupId?: string | null;
  adminId?: string | null;
  txType: WalletTxType;
  amount: number;
  balanceAfter: number;
  notes?: string | null;
  createdAt: string;
}

export interface OrderRating {
  id: string;
  orderId: string;
  raterId: string;
  ratedId: string;
  score: number;
  feedbackTags?: string[] | null;
  comment?: string | null;
  createdAt: string;
}

export interface PQRTicket {
  id: string;
  orderId: string;
  reporterId: string;
  reportedUserId: string;
  category: PQRCategory;
  description: string;
  evidenceUrls?: string[] | null;
  status: PQRStatus;
  adminResolutionNotes?: string | null;
  resolutionAction?: PQRResolutionAction | null;
  createdAt: string;
  updatedAt: string;
}
