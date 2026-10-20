import React, { useEffect, useRef, useState } from 'react';
import { View, Platform, Text, TouchableOpacity, Linking } from 'react-native';
import { GeoPoint } from '@plataforma/shared';
import { routingService, StreetRouteResult } from '../../services/routingService';

export interface NearbyCourierMarker {

  id: string;
  latitude: number;
  longitude: number;
  vehicleType?: string;
  bearing?: number;
  name?: string;
}

export interface OrderMarker {
  id: string;
  latitude: number;
  longitude: number;
  price?: number;
  serviceType?: string;
  label?: string;
}

interface UniversalMapProps {
  center?: GeoPoint;
  zoom?: number;
  origin?: GeoPoint | null;
  destination?: GeoPoint | null;
  intermediateStops?: GeoPoint[];
  routeCoordinates?: [number, number][];
  courierLocation?: { latitude: number; longitude: number; bearing?: number } | null;
  userLocation?: GeoPoint | null;
  nearbyCouriers?: NearbyCourierMarker[];
  orderMarkers?: OrderMarker[];
  darkMode?: boolean;
  onMapClick?: (point: GeoPoint) => void;
  className?: string;
}

export const UniversalMap: React.FC<UniversalMapProps> = ({
  center = { latitude: 6.2442, longitude: -75.5812 }, // Medellín por defecto
  zoom = 14,
  origin,
  destination,
  intermediateStops = [],
  routeCoordinates = [],
  courierLocation,
  userLocation,
  nearbyCouriers = [],
  orderMarkers = [],
  darkMode = false,
  onMapClick,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [streetRoute, setStreetRoute] = useState<StreetRouteResult | null>(null);

  // Obtener ruta real por calles mediante OSRM (soporta paradas intermedias múltiples)
  useEffect(() => {
    let isCurrent = true;
    if (origin && destination) {
      if (routeCoordinates && routeCoordinates.length > 0) {
        setStreetRoute({
          coordinates: routeCoordinates,
          distanceKm: 0,
          durationMinutes: 0,
        });
      } else {
        routingService.getStreetRoute(origin, destination, intermediateStops).then((res) => {
          if (isCurrent) {
            setStreetRoute(res);
          }
        });
      }
    } else {
      setStreetRoute(null);
    }
    return () => {
      isCurrent = false;
    };
  }, [
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
    JSON.stringify(intermediateStops),
    routeCoordinates,
  ]);

  // Asegurar que la hoja de estilos de MapLibre esté presente en el navegador
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const linkId = 'maplibre-gl-css';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
        document.head.appendChild(link);
      }
    }
  }, []);

  // Inicializar mapa MapLibre
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;

        const tiles = darkMode
          ? [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ]
          : [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ];

        if (!mapInstanceRef.current && mapContainerRef.current) {
          const map = new maplibregl.Map({
            container: mapContainerRef.current as HTMLElement,
            style: {
              version: 8,
              sources: {
                'osm-raster-tiles': {
                  type: 'raster',
                  tiles,
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors',
                },
              },
              layers: [
                {
                  id: 'osm-tiles-layer',
                  type: 'raster',
                  source: 'osm-raster-tiles',
                  minzoom: 0,
                  maxzoom: 19,
                },
              ],
            },
            center: [center.longitude, center.latitude],
            zoom: zoom,
          });

          map.on('load', () => {
            if (isMounted) setMapLoaded(true);
          });

          map.on('click', (e) => {
            if (onMapClick) {
              onMapClick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
            }
          });

          mapInstanceRef.current = map;
        } else if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter([center.longitude, center.latitude]);
        }
      } catch (err) {
        console.warn('Error inicializando MapLibre:', err);
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [center.latitude, center.longitude, zoom]);

  // Actualizar teselas dinámicamente si cambia darkMode
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    const map = mapInstanceRef.current;
    const tiles = darkMode
      ? [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ]
      : [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ];

    try {
      const source = map.getSource('osm-raster-tiles');
      if (source && typeof source.setTiles === 'function') {
        source.setTiles(tiles);
      }
    } catch {
      // Ignorar fallback
    }
  }, [darkMode, mapLoaded]);


  // Sincronizar centro cuando cambie center
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.easeTo({
        center: [center.longitude, center.latitude],
        duration: 800,
      });
    }
  }, [center?.latitude, center?.longitude]);

  // Actualizar marcadores y capas
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || Platform.OS !== 'web') return;

    const renderMarkers = async () => {
      const maplibregl = (await import('maplibre-gl')).default;

      // Helper para crear o mover marcador
      const updateOrCreateMarker = (
        key: string,
        coords: [number, number] | null,
        htmlContent: string
      ) => {
        if (!coords) {
          if (markersRef.current[key]) {
            markersRef.current[key].remove();
            delete markersRef.current[key];
          }
          return;
        }

        if (markersRef.current[key]) {
          markersRef.current[key].setLngLat(coords);
        } else {
          const el = document.createElement('div');
          el.innerHTML = htmlContent;
          el.style.cursor = 'pointer';

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map);

          markersRef.current[key] = marker;
        }
      };

      // 1. Marcador de Usuario (Tú)
      if (userLocation) {
        updateOrCreateMarker(
          'user_location',
          [userLocation.longitude, userLocation.latitude],
          `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 32px; height: 32px; background: rgba(59, 130, 246, 0.25); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 16px; height: 16px; background: #2563EB; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);"></div>
          </div>
          `
        );
      } else {
        updateOrCreateMarker('user_location', null, '');
      }

      // 2. Marcador de Origen
      if (origin) {
        updateOrCreateMarker(
          'origin',
          [origin.longitude, origin.latitude],
          `
          <div style="display: flex; flex-direction: column; align-items: center; transform: translate(0, -10px);">
            <div style="background: #10B981; color: white; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 4px;">
              <span>📍</span> <span>Recogida</span>
            </div>
            <div style="width: 2px; height: 8px; background: #10B981;"></div>
          </div>
          `
        );
      } else {
        updateOrCreateMarker('origin', null, '');
      }

      // 3. Marcador de Destino
      if (destination) {
        updateOrCreateMarker(
          'destination',
          [destination.longitude, destination.latitude],
          `
          <div style="display: flex; flex-direction: column; align-items: center; transform: translate(0, -10px);">
            <div style="background: #EF4444; color: white; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 4px;">
              <span>🏁</span> <span>Entrega</span>
            </div>
            <div style="width: 2px; height: 8px; background: #EF4444;"></div>
          </div>
          `
        );
      } else {
        updateOrCreateMarker('destination', null, '');
      }

      // 3.1 Marcadores de Paradas Intermedias (Multi-Drop)
      const currentStopKeys = new Set((intermediateStops || []).map((_, idx) => `stop_${idx}`));
      Object.keys(markersRef.current).forEach((k) => {
        if (k.startsWith('stop_') && !currentStopKeys.has(k)) {
          markersRef.current[k].remove();
          delete markersRef.current[k];
        }
      });

      (intermediateStops || []).forEach((stop, idx) => {
        const key = `stop_${idx}`;
        updateOrCreateMarker(
          key,
          [stop.longitude, stop.latitude],
          `
          <div style="display: flex; flex-direction: column; align-items: center; transform: translate(0, -10px);">
            <div style="background: #F59E0B; color: white; font-weight: 800; font-size: 11px; padding: 4px 8px; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 4px; border: 1.5px solid #FFFFFF;">
              <span>🟡</span> <span>Parada ${idx + 1}</span>
            </div>
            <div style="width: 2px; height: 8px; background: #F59E0B;"></div>
          </div>
          `
        );
      });


      // 4. Conductor Asignado en Vivo
      if (courierLocation) {
        updateOrCreateMarker(
          'courier_live',
          [courierLocation.longitude, courierLocation.latitude],
          `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="background: #FF6B00; color: white; padding: 6px 10px; border-radius: 20px; font-weight: 900; font-size: 12px; box-shadow: 0 4px 12px rgba(255, 107, 0, 0.4); display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 15px;">🛵</span> <span>Conductor</span>
            </div>
          </div>
          `
        );
      } else {
        updateOrCreateMarker('courier_live', null, '');
      }

      // 5. Conductores Cercanos Disponibles en la Zona (Estilo Uber / InDrive)
      const currentNearbyKeys = new Set(nearbyCouriers.map((c) => `nearby_${c.id}`));

      // Limpiar conductores que ya no están
      Object.keys(markersRef.current).forEach((k) => {
        if (k.startsWith('nearby_') && !currentNearbyKeys.has(k)) {
          markersRef.current[k].remove();
          delete markersRef.current[k];
        }
      });

      // Dibujar o mover conductores cercanos
      nearbyCouriers.forEach((courier) => {
        const key = `nearby_${courier.id}`;
        const isCar = courier.vehicleType === 'CAR';
        const icon = isCar ? '🚗' : '🛵';
        const title = isCar ? 'Carro' : 'Moto';

        updateOrCreateMarker(
          key,
          [courier.longitude, courier.latitude],
          `
          <div style="background: white; border: 2px solid #0F172A; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.25); transform: rotate(${courier.bearing || 0}deg); transition: all 0.5s ease-out;">
            <span style="font-size: 18px;">${icon}</span>
          </div>
          `
        );
      });

      // 6. Marcadores de Pedidos Disponibles en el Radar
      const currentOrderKeys = new Set(orderMarkers.map((o) => `order_${o.id}`));
      Object.keys(markersRef.current).forEach((k) => {
        if (k.startsWith('order_') && !currentOrderKeys.has(k)) {
          markersRef.current[k].remove();
          delete markersRef.current[k];
        }
      });

      orderMarkers.forEach((order) => {
        const key = `order_${order.id}`;
        const icon = order.serviceType === 'ERRAND' ? '🛒' : '📦';
        const priceText = order.price ? `$${order.price.toLocaleString()} COP` : 'Disponible';
        updateOrCreateMarker(
          key,
          [order.longitude, order.latitude],
          `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.2s;">
            <div style="background: #2563EB; color: white; padding: 4px 8px; border-radius: 12px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(37,99,235,0.4); display: flex; align-items: center; gap: 4px; white-space: nowrap; border: 1.5px solid #FFFFFF;">
              <span>${icon}</span> <span>${priceText}</span>
            </div>
            <div style="width: 2px; height: 6px; background: #2563EB;"></div>
          </div>
          `
        );
      });

      // 7. Trazar Línea de Ruta Real por Calles (OSRM OpenStreetMap Engine)
      const activeCoordinates =
        streetRoute && streetRoute.coordinates.length > 0
          ? streetRoute.coordinates
          : origin && destination
          ? [
              [origin.longitude, origin.latitude],
              [destination.longitude, destination.latitude],
            ]
          : [];

      if (origin && destination && activeCoordinates.length > 0) {
        const routeData = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: activeCoordinates,
          },
        };

        if (map.getSource('route-line')) {
          (map.getSource('route-line') as any).setData(routeData);
        } else if (mapLoaded) {
          map.addSource('route-line', {
            type: 'geojson',
            data: routeData,
          });

          map.addLayer({
            id: 'route-line-layer',
            type: 'line',
            source: 'route-line',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#2563EB',
              'line-width': 5.5,
              'line-opacity': 0.88,
            },
          });
        }
      } else {
        if (map.getLayer('route-line-layer')) {
          map.removeLayer('route-line-layer');
        }
        if (map.getSource('route-line')) {
          map.removeSource('route-line');
        }
      }
    };

    renderMarkers();
  }, [
    origin?.latitude,
    origin?.longitude,
    destination?.latitude,
    destination?.longitude,
    courierLocation?.latitude,
    courierLocation?.longitude,
    userLocation?.latitude,
    userLocation?.longitude,
    nearbyCouriers,
    orderMarkers,
    streetRoute,
    mapLoaded,
  ]);

  // Controles flotantes
  const handleRecenter = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15,
        essential: true,
      });
    } else if (mapInstanceRef.current && center) {
      mapInstanceRef.current.flyTo({
        center: [center.longitude, center.latitude],
        zoom: 15,
        essential: true,
      });
    }
  };

  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomTo(mapInstanceRef.current.getZoom() + delta);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (destination) {
      const url = routingService.getGoogleMapsNavUrl(destination, origin);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url).catch(() => {});
      }
    }
  };

  const handleOpenWaze = () => {
    if (destination) {
      const url = routingService.getWazeNavUrl(destination);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url).catch(() => {});
      }
    }
  };


  return (
    <View className={`w-full h-full relative overflow-hidden bg-slate-100 ${className}`}>
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      ) : (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-slate-500 font-medium text-center">
            [Mapa Nativo OpenStreetMap]
          </Text>
        </View>
      )}

      {/* Indicador superior OSM libre y Estado de Ruta */}
      <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between pointer-events-none z-10">
        <View className={`${darkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'} backdrop-blur-md px-3 py-1.5 rounded-full border shadow-md flex-row items-center gap-2 pointer-events-auto`}>
          <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <Text className={`text-xs font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {darkMode ? '🌙 OSM Dark Mode' : 'OpenStreetMap Live'}
          </Text>
        </View>

        {streetRoute && streetRoute.distanceKm > 0 && (
          <View className="bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-lg flex-row items-center gap-1.5 pointer-events-auto">
            <Text className="text-xs font-bold text-white">
              🚗 {streetRoute.distanceKm} km • ~{streetRoute.durationMinutes} min
            </Text>
          </View>
        )}
      </View>

      {/* Botones de Navegación Externa Waze / Google Maps si hay destino */}
      {destination && (
        <View className="absolute top-14 right-4 flex-row gap-2 z-10">
          <TouchableOpacity
            onPress={handleOpenGoogleMaps}
            className={`${darkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'} backdrop-blur-md px-3 py-1.5 rounded-full border shadow-md flex-row items-center gap-1 active:opacity-80`}
          >
            <Text className="text-xs font-bold text-blue-400">🗺️ Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleOpenWaze}
            className={`${darkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'} backdrop-blur-md px-3 py-1.5 rounded-full border shadow-md flex-row items-center gap-1 active:opacity-80`}
          >
            <Text className="text-xs font-bold text-cyan-400">🚙 Waze</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Controles de Mapa Flotantes */}
      <View className="absolute bottom-5 right-4 gap-2 z-10">
        <TouchableOpacity
          onPress={handleRecenter}
          className={`w-11 h-11 ${darkMode ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-white border-slate-200 active:bg-slate-100'} rounded-full items-center justify-center shadow-lg border`}
        >
          <Text className="text-lg">🎯</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleZoom(1)}
          className={`w-11 h-11 ${darkMode ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-white border-slate-200 active:bg-slate-100'} rounded-full items-center justify-center shadow-lg border`}
        >
          <Text className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>＋</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleZoom(-1)}
          className={`w-11 h-11 ${darkMode ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-white border-slate-200 active:bg-slate-100'} rounded-full items-center justify-center shadow-lg border`}
        >
          <Text className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>－</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

