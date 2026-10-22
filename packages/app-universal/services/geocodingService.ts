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

const NOMINATIM_HEADERS = {
  'Accept-Language': 'es-CO,es;q=0.9',
  'User-Agent': 'DOMYLogisticaApp/1.0 (contacto@adhsolutions.tech)',
};
const NOMINATIM_EMAIL = 'contacto@adhsolutions.tech';

export const geocodingService = {
  /**
   * Busca direcciones y lugares en Colombia utilizando Photon (OSM Komoot) como motor primario
   * (optimizado para autocompletado en tiempo real sin bloqueos de User-Agent en OkHttp/Android)
   * con respaldo automático en OpenStreetMap Nominatim. $0 Costo / Sin API Keys de Google.
   */
  async searchAddress(query: string, nearLocation?: GeoPoint | null): Promise<GeocodingSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const cacheKey = trimmed.toLowerCase();
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }

    // 1. INTENTO PRIMARIO: Photon (Komoot OSM)
    // Diseñado para autocompletado instantáneo y 100% amigable con dispositivos móviles Android
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&lang=es&limit=10`;
      if (nearLocation) {
        photonUrl += `&lat=${nearLocation.latitude}&lon=${nearLocation.longitude}`;
      }

      const res = await fetch(photonUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { features?: any[] };
        if (Array.isArray(data.features) && data.features.length > 0) {
          const suggestions: GeocodingSuggestion[] = data.features.map((f: any) => {
            const p = f.properties || {};
            const coords = f.geometry?.coordinates || [0, 0];
            const lon = coords[0];
            const lat = coords[1];

            const name = p.name || '';
            const street = p.street ? `${p.street}${p.housenumber ? ' #' + p.housenumber : ''}` : '';
            const district = p.district || p.locality || '';
            const city = p.city || p.county || p.state || '';
            const country = p.country || '';

            const shortTitle = street || name || district || 'Lugar encontrado';
            const subtitleParts = [name !== shortTitle ? name : '', district, city, country].filter(Boolean);
            const fullDisplay = subtitleParts.length > 0 ? `${shortTitle}, ${subtitleParts.join(', ')}` : shortTitle;

            return {
              displayName: fullDisplay,
              shortName: shortTitle,
              latitude: lat,
              longitude: lon,
              city,
              neighbourhood: district,
            };
          });

          // Priorizar cercanía si tenemos GPS de origen
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
      }
    } catch {
      // Si falla Photon, procedemos silenciosamente a Nominatim
    }

    // 2. INTENTO SECUNDARIO: Nominatim OpenStreetMap
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let viewboxParam = '';
      if (nearLocation) {
        const offset = 0.4;
        viewboxParam = `&viewbox=${nearLocation.longitude - offset},${nearLocation.latitude + offset},${nearLocation.longitude + offset},${nearLocation.latitude - offset}`;
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&countrycodes=co&limit=10&addressdetails=1${viewboxParam}&email=${NOMINATIM_EMAIL}`;

      const response = await fetch(url, {
        headers: NOMINATIM_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        let data = (await response.json()) as any[];

        if (data.length === 0 && nearLocation) {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            trimmed
          )}&countrycodes=co&limit=8&addressdetails=1&email=${NOMINATIM_EMAIL}`;
          try {
            const fallbackRes = await fetch(fallbackUrl, {
              headers: NOMINATIM_HEADERS,
            });
            if (fallbackRes.ok) {
              data = (await fallbackRes.json()) as any[];
            }
          } catch {
            // Ignorar
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
      console.warn('Error en geocodificación secundaria Nominatim:', err);
    }

    return [];
  },

  /**
   * Geocodificación inversa: de coordenadas GPS a dirección legible
   */
  async reverseGeocode(point: GeoPoint): Promise<string> {
    // 1. Photon Reverse
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const url = `https://photon.komoot.io/reverse?lat=${point.latitude}&lon=${point.longitude}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const p = data.features?.[0]?.properties;
        if (p) {
          const street = p.street ? `${p.street}${p.housenumber ? ' #' + p.housenumber : ''}` : '';
          const name = p.name || '';
          const city = p.city || p.locality || p.county || '';
          const title = street || name || city;
          if (title) return `${title}${city && title !== city ? ', ' + city : ''}`;
        }
      }
    } catch {
      // Fallback a Nominatim
    }

    // 2. Nominatim Reverse
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.latitude}&lon=${point.longitude}&addressdetails=1&email=${NOMINATIM_EMAIL}`;
      const response = await fetch(url, {
        headers: NOMINATIM_HEADERS,
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
