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

      // Priorizar vista cercana a los alrededores del usuario (ej: Quito, Bogotá, etc.)
      let viewboxParam = '';
      if (nearLocation) {
        const offset = 0.5; // ~50km de radio local
        viewboxParam = `&viewbox=${nearLocation.longitude - offset},${nearLocation.latitude + offset},${nearLocation.longitude + offset},${nearLocation.latitude - offset}&bounded=0`;
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&limit=6&addressdetails=1${viewboxParam}`;

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es,es-419;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any[];
        const suggestions: GeocodingSuggestion[] = data.map((item) => {
          const addr = item.address || {};
          const road = addr.road || addr.pedestrian || addr.suburb || item.name || '';
          const houseNumber = addr.house_number ? ` #${addr.house_number}` : '';
          const neighborhood = addr.neighbourhood || addr.suburb || '';
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
