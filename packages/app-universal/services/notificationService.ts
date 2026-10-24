import { Platform, Vibration } from 'react-native';
import { soundNotification } from './soundNotification';

let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    // Configurar cómo se comportan las notificaciones cuando la app está abierta o en primer plano
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
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
  channelType?: 'MESSAGES' | 'ALERTS';
  soundType?: 'CHIME' | 'MESSAGE' | 'NONE';
}

let lastNotificationSoundTime = 0;

export const notificationService = {
  initialized: false,

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (Platform.OS === 'android' && Notifications) {
      try {
        // Canal 1: Mensajes y Conversaciones de Chat (prioridad máxima, vibración doble, visible en reloj y lockscreen)
        await Notifications.setNotificationChannelAsync('domy_messages', {
          name: 'Mensajes de Chat',
          description: 'Notificaciones de mensajes de clientes y conductores en tiempo real',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: '#FF6B00',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });

        // Canal 2: Alertas de Servicios y Estado de Viaje
        await Notifications.setNotificationChannelAsync('domy_alerts', {
          name: 'Alertas de Servicios DOMY',
          description: 'Nuevos pedidos, asignaciones, llegadas de conductor y cancelaciones',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: '#FF6B00',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });
      } catch (err) {
        console.warn('Error configurando canales de notificaciones Android:', err);
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
   * Visible en pantalla de bloqueo y smartwatches.
   */
  async showSystemNotification(options: SystemNotificationOptions): Promise<void> {
    const soundEnabled = soundNotification.isSoundEnabled();
    const isMessage = options.channelType === 'MESSAGES' || options.soundType === 'MESSAGE';
    const channelId = isMessage ? 'domy_messages' : 'domy_alerts';
    const now = Date.now();

    // 1. Sonido y Vibración con debouncing para evitar saturación cuando llegan muchas ofertas juntas
    const canPlaySound = now - lastNotificationSoundTime > 900;
    if (soundEnabled && options.sound !== false && canPlaySound) {
      lastNotificationSoundTime = now;
      if (isMessage) {
        soundNotification.playMessageTone();
        try {
          Vibration.vibrate([0, 250, 150, 250]);
        } catch {}
      } else {
        soundNotification.playChime();
        try {
          Vibration.vibrate([0, 200, 100, 200]);
        } catch {}
      }
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
            sound: soundEnabled ? 'default' : undefined,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: isMessage ? [0, 250, 150, 250] : [0, 300, 200, 300],
            channelId,
          },
          trigger: null, // null = disparo inmediato en la bandeja del sistema
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
          const origin = window.location.origin || '';
          const iconUrl = `${origin}/icon-192.png`;
          const badgeUrl = `${origin}/badge.png`;

          new Notification(options.title, {
            body: options.body,
            icon: iconUrl,
            badge: badgeUrl,
            data: options.data || {},
            vibrate: isMessage ? [250, 150, 250] : [300, 200, 300],
            tag: options.data?.orderId ? `order_${options.data.orderId}` : undefined,
          } as any);
        }
      } catch {
        // Fallback
      }
    }
  },
};
