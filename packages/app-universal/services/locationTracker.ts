import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getSocket } from './socket';
import { appStorage } from './storage';
import { SOCKET_EVENTS } from '@plataforma/shared';

export const LOCATION_TASK_NAME = 'background-location-task';

let activeOrdersList: string[] = [];

export const setActiveOrdersForTracker = (orderIds: string[]) => {
  activeOrdersList = orderIds;
};

// Definir la tarea en segundo plano solo si TaskManager está disponible
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('Error en tarea de ubicación en segundo plano:', error);
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      const location = locations[0];
      if (location) {
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit(SOCKET_EVENTS.LOCATION_UPDATE, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            bearing: location.coords.heading || 0,
            speed: location.coords.speed || 0,
            activeOrderIds: activeOrdersList,
          });
        }
      }
    }
  });
}

let webWatchId: number | null = null;
let webPollInterval: ReturnType<typeof setInterval> | null = null;

export const locationTracker = {
  getCachedLocation(): { latitude: number; longitude: number } | null {
    return appStorage.getJSON<{ latitude: number; longitude: number }>('last_known_location');
  },

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        // Si el navegador soporta permissions API, verificar si ya está concedido
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            if (status.state === 'granted') {
              appStorage.setItem('gps_permission_granted', 'true');
              return true;
            }
          } catch {
            // Continuar con solicitud normal
          }
        }

        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              appStorage.setJSON('last_known_location', loc);
              appStorage.setItem('gps_permission_granted', 'true');
              resolve(true);
            },
            () => {
              // Intento con menor precisión si alta precisión falla
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                  appStorage.setJSON('last_known_location', loc);
                  appStorage.setItem('gps_permission_granted', 'true');
                  resolve(true);
                },
                (err) => {
                  console.warn('Permiso GPS navegador no otorgado:', err.message);
                  resolve(false);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
              );
            },
            { enableHighAccuracy: true, timeout: 6000 }
          );
        });
      }
      return false;
    }

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  },

  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              appStorage.setJSON('last_known_location', loc);
              resolve(loc);
            },
            () => {
              // Intento fallback con baja precisión / caché
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                  appStorage.setJSON('last_known_location', loc);
                  resolve(loc);
                },
                () => {
                  // Fallback a ubicación en caché si falla la red
                  const cached = locationTracker.getCachedLocation();
                  resolve(cached);
                },
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
              );
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
      return locationTracker.getCachedLocation();
    }

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      appStorage.setJSON('last_known_location', coords);
      return coords;
    } catch {
      return locationTracker.getCachedLocation();
    }
  },

  async startTracking(orderIds: string[] = []) {
    activeOrdersList = orderIds;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        if (webWatchId !== null) {
          navigator.geolocation.clearWatch(webWatchId);
          webWatchId = null;
        }
        if (webPollInterval !== null) {
          clearInterval(webPollInterval);
          webPollInterval = null;
        }

        const emitPosition = (pos: GeolocationPosition) => {
          const socket = getSocket();
          if (socket && socket.connected) {
            socket.emit(SOCKET_EVENTS.LOCATION_UPDATE, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              bearing: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
              activeOrderIds: activeOrdersList,
            });
          }
        };

        webWatchId = navigator.geolocation.watchPosition(
          emitPosition,
          (err) => console.warn('Error rastreando GPS web:', err.message),
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );

        // Sondeo activo periódico cada 3.5 segundos por si el navegador pausa watchPosition durante llamadas o tabs en fondo
        webPollInterval = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            emitPosition,
            () => {},
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
          );
        }, 3500);
      }
      return;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!hasStarted) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 4000, // Cada 4 segundos
        distanceInterval: 15, // Cada 15 metros
        foregroundService: {
          notificationTitle: 'Plataforma Conductor Activo',
          notificationBody: 'Transmitiendo posición GPS de entrega en tiempo real',
          notificationColor: '#FF6B00',
        },
      });
    }
  },

  async stopTracking() {
    if (Platform.OS === 'web') {
      if (webWatchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(webWatchId);
        webWatchId = null;
      }
      if (webPollInterval !== null) {
        clearInterval(webPollInterval);
        webPollInterval = null;
      }
      return;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  },
};
