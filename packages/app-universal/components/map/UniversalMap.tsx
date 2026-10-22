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
  isSearching?: boolean;
  darkMode?: boolean;
  onMapClick?: (point: GeoPoint) => void;
  onRouteCalculated?: (coords: [number, number][]) => void;
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
  isSearching = false,
  darkMode = false,
  onMapClick,
  onRouteCalculated,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const lastFittedRouteRef = useRef<string>('');
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
        onRouteCalculated?.(routeCoordinates);
      } else {
        routingService.getStreetRoute(origin, destination, intermediateStops).then((res) => {
          if (isCurrent) {
            setStreetRoute(res);
            onRouteCalculated?.(res.coordinates);
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

  // Asegurar que la hoja de estilos de MapLibre esté presente en el navegador y estilo para modo oscuro
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

      const darkStyleId = 'maplibre-dark-mode-style';
      if (!document.getElementById(darkStyleId)) {
        const style = document.createElement('style');
        style.id = darkStyleId;
        style.textContent = `
          .dark-map-mode .maplibregl-canvas {
            filter: invert(90%) hue-rotate(180deg) brightness(85%) contrast(115%) !important;
          }
          @keyframes radar-ripple {
            0% {
              transform: scale(0.1);
              opacity: 0.95;
            }
            60% {
              opacity: 0.5;
            }
            100% {
              transform: scale(3.5);
              opacity: 0;
            }
          }
          @keyframes radar-pulse-core {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 15px rgba(255, 107, 0, 0.7);
            }
            50% {
              transform: scale(1.15);
              box-shadow: 0 0 30px rgba(255, 107, 0, 1);
            }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Inicializar mapa MapLibre
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        const maplibreglModule = require('maplibre-gl');
        const maplibregl = maplibreglModule.default || maplibreglModule;

        // Teselas OpenStreetMap 100% libres y sin necesidad de API keys
        const tiles = [
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
      const maplibreglModule = require('maplibre-gl');
      const maplibregl = maplibreglModule.default || maplibreglModule;

      // Helper para crear o mover marcador con suavizado continuo de posición
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
          const marker = markersRef.current[key];
          const el = marker.getElement();
          if (el) {
            // Suavizado de traslación CSS para movimiento fluido en tiempo real
            el.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)';
            if (el.innerHTML !== htmlContent) {
              el.innerHTML = htmlContent;
            }
          }
          marker.setLngLat(coords);
        } else {
          const el = document.createElement('div');
          el.innerHTML = htmlContent;
          el.style.cursor = 'pointer';
          el.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)';

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

      // 2.1 Radar de Notificación en Vivo a Conductores Cercanos (Estilo Uber / InDrive)
      const radarPoint = origin || userLocation;
      if (isSearching && radarPoint) {
        updateOrCreateMarker(
          'radar_search',
          [radarPoint.longitude, radarPoint.latitude],
          `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; pointer-events: none;">
            <div style="position: absolute; width: 140px; height: 140px; border-radius: 50%; border: 2.5px solid rgba(255, 107, 0, 0.85); background: radial-gradient(circle, rgba(255, 107, 0, 0.28) 0%, rgba(255, 107, 0, 0) 70%); animation: radar-ripple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite; animation-delay: 0s;"></div>
            <div style="position: absolute; width: 140px; height: 140px; border-radius: 50%; border: 2px solid rgba(255, 107, 0, 0.65); background: radial-gradient(circle, rgba(255, 107, 0, 0.2) 0%, rgba(255, 107, 0, 0) 70%); animation: radar-ripple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite; animation-delay: 0.8s;"></div>
            <div style="position: absolute; width: 140px; height: 140px; border-radius: 50%; border: 1.5px solid rgba(255, 107, 0, 0.45); animation: radar-ripple 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite; animation-delay: 1.6s;"></div>
            <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background: #FF6B00; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center; animation: radar-pulse-core 1.2s ease-in-out infinite; box-shadow: 0 4px 15px rgba(255, 107, 0, 0.7);">
              <span style="font-size: 16px;">📡</span>
            </div>
            <div style="position: absolute; top: -38px; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(4px); color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 14px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255, 107, 0, 0.6); display: flex; align-items: center; gap: 5px;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #10B981;"></span>
              <span>Notificando conductores cercanos...</span>
            </div>
          </div>
          `
        );
      } else {
        updateOrCreateMarker('radar_search', null, '');
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

        const isStyleReady = map.isStyleLoaded ? map.isStyleLoaded() : mapLoaded;

        if (map.getSource('route-line')) {
          (map.getSource('route-line') as any).setData(routeData);
        } else if (isStyleReady) {
          try {
            map.addSource('route-line', {
              type: 'geojson',
              data: routeData,
            });

            map.addLayer({
              id: 'route-line-casing',
              type: 'line',
              source: 'route-line',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#1E3A8A',
                'line-width': 8,
                'line-opacity': 0.75,
              },
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
                'line-opacity': 0.95,
              },
            });
          } catch {
            // Estilo aún cargando
          }
        }

        // Auto-encuadre inteligente: solo cuando la ruta cambia o inicia, sin interrumpir el zoom manual del usuario
        const routeHash = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}_${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}_${activeCoordinates.length}`;
        if (activeCoordinates.length > 1 && lastFittedRouteRef.current !== routeHash) {
          lastFittedRouteRef.current = routeHash;
          try {
            const bounds = new maplibregl.LngLatBounds();
            activeCoordinates.forEach((coord: number[]) => {
              if (coord && coord.length >= 2) {
                bounds.extend([coord[0], coord[1]]);
              }
            });
            map.fitBounds(bounds, {
              padding: { top: 60, bottom: 80, left: 40, right: 40 },
              maxZoom: 16,
              duration: 900,
            });
          } catch {
            // Ignorar si el mapa está en transición
          }
        }
      } else {
        if (map.getLayer('route-line-casing')) {
          map.removeLayer('route-line-casing');
        }
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
    isSearching,
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
        <div
          ref={mapContainerRef}
          className={darkMode ? 'dark-map-mode' : ''}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
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

