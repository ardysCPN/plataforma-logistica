/**
 * Constantes y Contratos de Eventos Socket.io
 * Definidos en agent.md - Sección 8
 */

import { GeoPoint, ServiceType, OrderStatus, MessageType, VehicleType } from '../types';

export const SOCKET_EVENTS = {
  // Órdenes y Radar
  ORDER_NEW_AVAILABLE: 'order:new_available',
  ORDER_CORRIDOR_ALERT: 'order:corridor_alert',
  ORDER_ASSIGNED: 'order:assigned',
  ORDER_STATUS_CHANGE: 'order:status_change',
  ORDER_COMPLETED: 'order:completed',
  ORDER_CANCELLED: 'order:cancelled',

  // Subasta y Ofertas
  BID_SUBMIT: 'bid:submit',
  BID_RECEIVED: 'bid:received',
  BID_ACCEPT: 'bid:accept',
  BID_REJECTED: 'bid:rejected',

  // Ubicación GPS en Vivo
  LOCATION_UPDATE: 'location:update',
  LOCATION_CLIENT_FEED: 'location:client_feed',

  // Chat en Tiempo Real
  CHAT_SEND: 'chat:send',
  CHAT_RECEIVE: 'chat:receive',
  CHAT_TYPING: 'chat:typing',
} as const;

export interface SocketOrderNewAvailablePayload {
  orderId: string;
  serviceType: ServiceType;
  originAddress: string;
  originPoint: GeoPoint;
  destinationAddress: string;
  destinationPoint: GeoPoint;
  offeredPrice: number;
  descriptionNotes?: string | null;
  estimatedPurchaseCost?: number;
  createdAt: string;
}

export interface SocketCorridorAlertPayload {
  orderId: string;
  serviceType: ServiceType;
  extraEarnings: number;
  originAddress: string;
  originPoint: GeoPoint;
  destinationAddress: string;
  destinationPoint: GeoPoint;
  detourMeters: number;
}

export interface SocketBidSubmitPayload {
  orderId: string;
  bidAmount: number;
  etaMinutes?: number | null;
}

export interface SocketBidReceivedPayload {
  bidId: string;
  orderId: string;
  courierId: string;
  courierName: string;
  courierRating: number;
  courierAvatarUrl?: string | null;
  vehicleType: VehicleType;
  vehiclePlate?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  bidAmount: number;
  etaMinutes?: number | null;
  createdAt: string;
}

export interface SocketBidAcceptPayload {
  orderId: string;
  bidId: string;
}

export interface SocketOrderAssignedPayload {
  orderId: string;
  status: OrderStatus;
  agreedPrice: number;
  deliveryPin?: string; // Solo visible para el cliente
  courier: {
    id: string;
    fullName: string;
    phone: string;
    avatarUrl?: string | null;
    ratingAvg: number;
    vehicleType: VehicleType;
    vehiclePlate?: string | null;
    vehicleModel?: string | null;
    vehicleColor?: string | null;
  };
  client: {
    id: string;
    fullName: string;
    phone: string;
  };
}

export interface SocketLocationUpdatePayload {
  latitude: number;
  longitude: number;
  bearing: number;
  speed?: number | null;
  activeOrderIds: string[];
}

export interface SocketLocationClientFeedPayload {
  orderId: string;
  latitude: number;
  longitude: number;
  bearing: number;
  etaSeconds?: number | null;
}

export interface SocketChatSendPayload {
  orderId: string;
  messageType: MessageType;
  content: string;
  imageUrl?: string | null;
}

export interface SocketChatReceivePayload {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  messageType: MessageType;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}

export interface SocketOrderStatusChangePayload {
  orderId: string;
  newStatus: OrderStatus;
  updatedAt: string;
  details?: Record<string, unknown>;
}
