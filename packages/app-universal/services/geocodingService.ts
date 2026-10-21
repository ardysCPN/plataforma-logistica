import { GeoPoint } from '@plataforma/shared';

export interface GeocodingSuggestion {
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  city?: string;
  neighbourhood?: string;
}

const geocodeCache = new Map<string, GeocodingSuggestion[]>();

export const geocodingService = {
  /**
   * Busca direcciones y lugares en Colombia vía Nominatim OpenStreetMap ($0 Costo)
   */
  async searchAddress(query: string, nearLocation?: GeoPoint | null): Promise<GeocodingSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const cacheKey = trimmed.toLowerCase();
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Priorizar y restringir estrictamente al municipio local en Colombia (ej: Quibdó, Medellín, Cali, etc.)
      let viewboxParam = '';
      if (nearLocation) {
        const offset = 0.20; // Radio de ~20km para limitar al municipio/ciudad
        viewboxParam = `&viewbox=${nearLocation.longitude - offset},${nearLocation.latitude + offset},${nearLocation.longitude + offset},${nearLocation.latitude - offset}&bounded=1`;
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&countrycodes=co&limit=8&addressdetails=1${viewboxParam}`;

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es-CO,es;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        let data = (await response.json()) as any[];

        // Si con límite estricto municipal (20km) no hubo coincidencias, ampliar a perímetro subregional (35km) con bounded=1
        if (data.length === 0 && nearLocation) {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            trimmed
          )}&countrycodes=co&limit=8&addressdetails=1&viewbox=${nearLocation.longitude - 0.35},${nearLocation.latitude + 0.35},${nearLocation.longitude + 0.35},${nearLocation.latitude - 0.35}&bounded=1`;
          try {
            const fallbackRes = await fetch(fallbackUrl, {
              headers: { 'Accept-Language': 'es-CO,es;q=0.9' },
            });
            if (fallbackRes.ok) {
              data = (await fallbackRes.json()) as any[];
            }
          } catch {
            // Mantener datos vacíos si falla
          }
        }

        const suggestions: GeocodingSuggestion[] = data.map((item) => {
          const addr = item.address || {};
          const road = addr.road || addr.pedestrian || addr.suburb || item.name || '';
          const houseNumber = addr.house_number ? ` #${addr.house_number}` : '';
          const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || '';
          const city = addr.city || addr.town || addr.municipality || addr.state || '';

          const short = road ? `${road}${houseNumber}${neighborhood ? ', ' + neighborhood : ''}` : item.display_name.split(',')[0];

          return {
            displayName: item.display_name,
            shortName: short || item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            city,
            neighbourhood: neighborhood,
          };
        });

        // Priorizar ordenando por cercanía física (menor distancia a la geolocalización del usuario)
        if (nearLocation && suggestions.length > 1) {
          suggestions.sort((a, b) => {
            const distA = Math.hypot(a.latitude - nearLocation.latitude, a.longitude - nearLocation.longitude);
            const distB = Math.hypot(b.latitude - nearLocation.latitude, b.longitude - nearLocation.longitude);
            return distA - distB;
          });
        }

        geocodeCache.set(cacheKey, suggestions);
        return suggestions;
      }
    } catch (err) {
      console.warn('Error en geocodificación Nominatim:', err);
    }

    return [];
  },

  /**
   * Geocodificación inversa: de coordenadas a nombre de calle legible
   */
  async reverseGeocode(point: GeoPoint): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.latitude}&lon=${point.longitude}&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'es-CO,es;q=0.9' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.neighbourhood || '';
        const city = addr.city || addr.town || addr.municipality || '';
        if (road) return `${road}${city ? ', ' + city : ''}`;
        return data.display_name?.split(',').slice(0, 2).join(',') || `Punto (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`;
      }
    } catch {
      // Fallback
    }

    return `Ubicación (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`;
  },
};
