import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getSocket } from './socket';
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

export const locationTracker = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            (err) => {
              console.warn('Permiso de GPS en navegador rechazado o fallido:', err.message);
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
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
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }
      return null;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      return null;
    }
  },

  async startTracking(orderIds: string[] = []) {
    activeOrdersList = orderIds;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        if (webWatchId !== null) {
          navigator.geolocation.clearWatch(webWatchId);
        }
        webWatchId = navigator.geolocation.watchPosition(
          (pos) => {
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
          },
          (err) => console.warn('Error rastreando GPS web:', err.message),
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
        );
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
      return;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  },
};
