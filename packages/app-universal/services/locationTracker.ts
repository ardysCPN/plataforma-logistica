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

export const locationTracker = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  },

  async startTracking(orderIds: string[] = []) {
    activeOrdersList = orderIds;
    if (Platform.OS === 'web') return;

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
    if (Platform.OS === 'web') return;
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  },
};
