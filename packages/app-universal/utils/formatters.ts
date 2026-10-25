/**
 * Utilidades de traducción y formato en Español Colombiano para DOMY
 * Garantiza que toda la plataforma muestre términos amigables y comprensibles.
 */

export const formatServiceType = (type?: string): string => {
  if (!type) return 'Servicio';
  switch (type.toUpperCase()) {
    case 'ERRAND':
      return 'Mandado';
    case 'DELIVERY':
      return 'Encomienda';
    case 'TRANSPORT':
      return 'Transporte';
    default:
      return type;
  }
};

export const formatOrderStatus = (status?: string): string => {
  if (!status) return '';
  switch (status.toUpperCase()) {
    case 'SEARCHING':
      return 'Buscando conductor';
    case 'ACCEPTED':
      return 'Conductor asignado';
    case 'ARRIVED_AT_ORIGIN':
      return 'Conductor en el punto de recogida';
    case 'PURCHASING':
      return 'Realizando compras del mandado';
    case 'PICKED_UP':
      return 'En camino con el pedido / pasajero';
    case 'IN_TRANSIT':
      return 'En trayecto hacia destino final';
    case 'COMPLETED':
      return 'Servicio completado';
    case 'CANCELLED':
      return 'Servicio cancelado';
    default:
      return status;
  }
};

export const getServiceIcon = (type?: string): string => {
  switch (type?.toUpperCase()) {
    case 'ERRAND':
      return '🛒';
    case 'DELIVERY':
      return '📦';
    case 'TRANSPORT':
    default:
      return '🛵';
  }
};

export const formatVehicleType = (type?: string): string => {
  if (!type) return 'Vehículo';
  switch (type.toUpperCase()) {
    case 'CAR':
    case 'AUTO':
      return 'Carro';
    case 'MOTORCYCLE':
    case 'MOTO':
      return 'Moto';
    case 'BICYCLE':
    case 'BICI':
      return 'Bicicleta';
    default:
      return type;
  }
};

export const formatCurrencyCop = (amount?: number | string | null): string => {
  const num = typeof amount === 'string' ? Number(amount.replace(/\D/g, '')) : Number(amount || 0);
  return `$${num.toLocaleString('es-CO')} COP`;
};
