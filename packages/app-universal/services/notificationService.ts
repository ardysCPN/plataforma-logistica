import { Platform, Vibration } from 'react-native';
import { soundNotification } from './soundNotification';

let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    // Configurar cómo se comportan las notificaciones cuando la app está abierta (foreground)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
  } catch (err) {
    console.warn('expo-notifications no disponible:', err);
  }
}

export interface SystemNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
}

export const notificationService = {
  initialized: false,

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (Platform.OS === 'android' && Notifications) {
      try {
        await Notifications.setNotificationChannelAsync('domy_alerts', {
          name: 'Alertas de Servicios DOMY',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: '#FF6B00',
          sound: 'default',
          enableVibrate: true,
        });
      } catch (err) {
        console.warn('Error configurando canal de notificaciones Android:', err);
      }
    }

    // Solicitar permisos de notificación si es necesario
    try {
      if (Platform.OS !== 'web' && Notifications) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } else if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch {
      // Ignorar errores de permisos
    }
  },

  /**
   * Dispara una notificación nativa en la bandeja del sistema operativo del celular
   * con sonido y vibración, y en web con Web Notifications API.
   */
  async showSystemNotification(options: SystemNotificationOptions): Promise<void> {
    const soundEnabled = soundNotification.isSoundEnabled();

    // 1. Sonido y Vibración inmediata
    if (soundEnabled && options.sound !== false) {
      soundNotification.playChime();
      try {
        Vibration.vibrate([0, 200, 100, 200]);
      } catch {}
    }

    // 2. Notificación en Móvil (Android / iOS)
    if (Platform.OS !== 'web' && Notifications) {
      try {
        await this.init();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: options.title,
            body: options.body,
            data: options.data || {},
            sound: soundEnabled,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 250, 150, 250],
            channelId: 'domy_alerts',
          },
          trigger: null, // null = disparo inmediato
        });
      } catch (err) {
        console.warn('Error enviando notificación móvil nativa:', err);
      }
      return;
    }

    // 3. Notificación en Web (Navegador de Escritorio o PWA)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(options.title, {
            body: options.body,
            icon: '/favicon.png',
            badge: '/favicon.png',
          });
        }
      } catch {
        // Fallback
      }
    }
  },
};
