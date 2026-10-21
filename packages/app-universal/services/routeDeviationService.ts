import { GeoPoint } from '@plataforma/shared';

/**
 * Calcula la distancia mínima en metros entre la posición actual del conductor
 * y la línea de ruta planificada (coordenadas OSRM [longitud, latitud]).
 */

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Distancia perpendicular en metros desde un punto a un segmento de recta A-B
 */
function pointToSegmentDistanceMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = Math.PI / 180;
  const meanLat = ((aLat + bLat) / 2) * toRad;
  const cosLat = Math.cos(meanLat);

  // Proyección plana local precisa para distancias cortas (< 50km)
  const ax = aLng * toRad * EARTH_RADIUS_METERS * cosLat;
  const ay = aLat * toRad * EARTH_RADIUS_METERS;
  const bx = bLng * toRad * EARTH_RADIUS_METERS * cosLat;
  const by = bLat * toRad * EARTH_RADIUS_METERS;
  const px = pLng * toRad * EARTH_RADIUS_METERS * cosLat;
  const py = pLat * toRad * EARTH_RADIUS_METERS;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY);
}

export interface DeviationCheckResult {
  isDeviated: boolean;
  distanceMeters: number;
}

export const routeDeviationService = {
  /**
   * Calcula la distancia más corta del conductor a la ruta en metros
   * routeCoords viene en formato GeoJSON [longitude, latitude]
   */
  getDistanceToRoute(
    courierLocation: { latitude: number; longitude: number },
    routeCoords: [number, number][]
  ): number {
    if (!courierLocation || !routeCoords || routeCoords.length === 0) {
      return 0;
    }

    if (routeCoords.length === 1) {
      const [lng, lat] = routeCoords[0];
      return haversineDistanceMeters(
        courierLocation.latitude,
        courierLocation.longitude,
        lat,
        lng
      );
    }

    let minDistance = Infinity;
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [aLng, aLat] = routeCoords[i];
      const [bLng, bLat] = routeCoords[i + 1];
      const dist = pointToSegmentDistanceMeters(
        courierLocation.latitude,
        courierLocation.longitude,
        aLat,
        aLng,
        bLat,
        bLng
      );
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return minDistance;
  },

  /**
   * Determina si el conductor se ha desviado significativamente de la ruta.
   * Por defecto, un desvío mayor a 450 metros se considera fuera de la ruta establecida.
   */
  checkDeviation(
    courierLocation: { latitude: number; longitude: number } | null | undefined,
    routeCoords: [number, number][],
    destinationPoint?: GeoPoint | null,
    thresholdMeters: number = 450
  ): DeviationCheckResult {
    if (!courierLocation || !routeCoords || routeCoords.length < 2) {
      return { isDeviated: false, distanceMeters: 0 };
    }

    // Si ya está muy cerca del destino final (< 250m), no generar falsas alertas por estacionamiento
    if (destinationPoint) {
      const distToDest = haversineDistanceMeters(
        courierLocation.latitude,
        courierLocation.longitude,
        destinationPoint.latitude,
        destinationPoint.longitude
      );
      if (distToDest < 250) {
        return { isDeviated: false, distanceMeters: distToDest };
      }
    }

    const distanceMeters = this.getDistanceToRoute(courierLocation, routeCoords);
    const isDeviated = distanceMeters > thresholdMeters;

    return {
      isDeviated,
      distanceMeters,
    };
  },
};
