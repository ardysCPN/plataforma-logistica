import { db } from '../../config/database';
import { env } from '../../config/env';
import { GeoPoint } from '@plataforma/shared';

export interface RouteCalculationResult {
  coordinates: [number, number][]; // [lng, lat]
  distanceMeters: number;
  durationSeconds: number;
}

export const corridorService = {
  /**
   * Consulta a OSRM para obtener la polilínea y distancia de ruta óptima
   */
  async getRouteGeometry(origin: GeoPoint, destination: GeoPoint): Promise<RouteCalculationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `${env.OSRM_URL}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          code: string;
          routes?: Array<{
            geometry: { coordinates: [number, number][] };
            distance: number;
            duration: number;
          }>;
        };

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          return {
            coordinates: route.geometry.coordinates,
            distanceMeters: Math.round(route.distance),
            durationSeconds: Math.round(route.duration),
          };
        }
      }
    } catch {
      // Fallback si OSRM no responde de inmediato en desarrollo local
    }

    // Geometría estimada directa si OSRM está en inicialización
    return {
      coordinates: [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
      ],
      distanceMeters: 3000,
      durationSeconds: 600,
    };
  },

  /**
   * Actualiza el corredor activo del conductor en PostGIS
   */
  async updateCourierCorridor(courierId: string, coordinates: [number, number][]): Promise<void> {
    if (coordinates.length < 2) return;

    // Convertir coordenadas [lng, lat] a formato WKT LINESTRING
    const lineStringWkt = `LINESTRING(${coordinates.map((c) => `${c[0]} ${c[1]}`).join(', ')})`;

    await db.query(
      `UPDATE courier_profiles
       SET active_route_corridor = ST_GeomFromText($1, 4326), updated_at = NOW()
       WHERE user_id = $2`,
      [lineStringWkt, courierId]
    );
  },

  /**
   * Algoritmo PostGIS de Corredor de 400m con verificación direccional
   */
  async findBatchEligibleCouriers(origin: GeoPoint, destination: GeoPoint): Promise<string[]> {
    const query = `
      SELECT cp.user_id as "courierId"
      FROM courier_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.is_online = TRUE
        AND u.status = 'ACTIVE'
        AND cp.active_orders_count < 3
        AND cp.active_route_corridor IS NOT NULL
        -- Validar que ambos puntos caigan dentro del corredor de 400 metros
        AND ST_DWithin(
          cp.active_route_corridor::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          400
        )
        AND ST_DWithin(
          cp.active_route_corridor::geography,
          ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
          400
        )
        -- Validar compatibilidad de sentido de marcha
        AND ST_LineLocatePoint(
          cp.active_route_corridor::geometry,
          ST_SetSRID(ST_MakePoint($3, $4), 4326)::geometry
        ) > ST_LineLocatePoint(
          cp.active_route_corridor::geometry,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geometry
        );
    `;

    const res = await db.query<{ courierId: string }>(query, [
      origin.longitude,
      origin.latitude,
      destination.longitude,
      destination.latitude,
    ]);

    return res.rows.map((r) => r.courierId);
  },
};
