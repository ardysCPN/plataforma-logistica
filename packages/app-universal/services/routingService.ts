import { GeoPoint } from '@plataforma/shared';

export interface StreetRouteResult {
  coordinates: [number, number][]; // [longitude, latitude]
  distanceKm: number;
  durationMinutes: number;
}

// Caché en memoria para evitar llamadas redundantes de ruteo
const routeCache = new Map<string, StreetRouteResult>();

export const routingService = {
  /**
   * Obtiene la polilínea exacta por calles reales usando el motor OSRM (OpenStreetMap)
   * Soporta paradas intermedias múltiples (waypoints)
   */
  async getStreetRoute(start: GeoPoint, end: GeoPoint, waypoints?: GeoPoint[]): Promise<StreetRouteResult> {
    const validWaypoints = (waypoints || []).filter((w) => w && typeof w.latitude === 'number');
    const waypointsKey = validWaypoints.map((w) => `${w.latitude.toFixed(4)},${w.longitude.toFixed(4)}`).join(';');
    const cacheKey = `${start.latitude.toFixed(4)},${start.longitude.toFixed(4)}_${waypointsKey}_${end.latitude.toFixed(4)},${end.longitude.toFixed(4)}`;
    if (routeCache.has(cacheKey)) {
      return routeCache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const points = [
        `${start.longitude},${start.latitude}`,
        ...validWaypoints.map((w) => `${w.longitude},${w.latitude}`),
        `${end.longitude},${end.latitude}`,
      ].join(';');

      const url = `https://router.project-osrm.org/route/v1/driving/${points}?overview=full&geometries=geojson`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const result: StreetRouteResult = {
            coordinates: route.geometry.coordinates as [number, number][],
            distanceKm: Number((route.distance / 1000).toFixed(1)),
            durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          };
          routeCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (err) {
      console.warn('Error consultando OSRM Street Router:', err);
    }


    // Fallback geométrico si la red o servicio OSRM no responde
    const fallback: StreetRouteResult = {
      coordinates: [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
      ],
      distanceKm: 2.5,
      durationMinutes: 8,
    };
    return fallback;
  },

  /**
   * Genera enlace directo a Google Maps con navegación punto a punto
   */
  getGoogleMapsNavUrl(destination: GeoPoint, origin?: GeoPoint | null): string {
    if (origin) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
  },

  /**
   * Genera enlace directo a Waze
   */
  getWazeNavUrl(destination: GeoPoint): string {
    return `https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`;
  },
};
