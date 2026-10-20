import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { GeoPoint } from '@plataforma/shared';

interface UniversalMapProps {
  center?: GeoPoint;
  zoom?: number;
  origin?: GeoPoint | null;
  destination?: GeoPoint | null;
  routeCoordinates?: [number, number][];
  courierLocation?: { latitude: number; longitude: number; bearing?: number } | null;
  onMapClick?: (point: GeoPoint) => void;
  className?: string;
}

export const UniversalMap: React.FC<UniversalMapProps> = ({
  center = { latitude: 6.2442, longitude: -75.5812 }, // Medellín por defecto
  zoom = 13,
  origin,
  destination,
  routeCoordinates = [],
  courierLocation,
  onMapClick,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !mapContainerRef.current) return;

    // Carga dinámica de MapLibre GL en Web
    const initWebMap = async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;

        if (!mapInstanceRef.current) {
          const map = new maplibregl.Map({
            container: mapContainerRef.current as HTMLElement,
            style: {
              version: 8,
              sources: {
                'carto-positron': {
                  type: 'raster',
                  tiles: [
                    'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png',
                  ],
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors, © CARTO',
                },
              },
              layers: [
                {
                  id: 'carto-tiles',
                  type: 'raster',
                  source: 'carto-positron',
                  minzoom: 0,
                  maxzoom: 19,
                },
              ],
            },
            center: [center.longitude, center.latitude],
            zoom: zoom,
          });

          map.on('click', (e) => {
            if (onMapClick) {
              onMapClick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
            }
          });

          mapInstanceRef.current = map;
        } else {
          mapInstanceRef.current.setCenter([center.longitude, center.latitude]);
        }
      } catch (err) {
        console.warn('Error inicializando MapLibre GL:', err);
      }
    };

    initWebMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center.latitude, center.longitude]);

  return (
    <View className={`w-full h-full relative overflow-hidden bg-slate-100 ${className}`}>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      ) : (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-slate-500 font-medium text-center">
            [Mapa Nativo OpenStreetMap - MapLibre Mobile Engine]
          </Text>
          {origin && (
            <Text className="text-xs text-slate-700 mt-2">
              Origen: {origin.latitude.toFixed(4)}, {origin.longitude.toFixed(4)}
            </Text>
          )}
          {destination && (
            <Text className="text-xs text-slate-700">
              Destino: {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
            </Text>
          )}
        </View>
      )}

      {/* Indicadores flotantes de estado del mapa */}
      <View className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm flex-row items-center gap-2">
        <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <Text className="text-xs font-semibold text-slate-800">OSM Live Tiles ($0 API)</Text>
      </View>
    </View>
  );
};
