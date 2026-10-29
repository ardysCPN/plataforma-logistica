import React, { useState, useEffect } from 'react';
import { View, Text, Platform, Animated } from 'react-native';
import { getSocket } from '../../services/socket';

export const NetworkStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Detección en Web / PWA mediante navigator
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        setIsOffline(!navigator.onLine);
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // 2. Detección en Móvil mediante eventos de Socket.io con debounce antirruido
    const socket = getSocket();
    let offlineTimer: any = null;

    const handleConnect = () => {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      setIsOffline(false);
    };

    const handleDisconnect = (reason: string) => {
      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
        if (!offlineTimer) {
          offlineTimer = setTimeout(() => {
            setIsOffline(true);
          }, 3000);
        }
      }
    };

    const handleConnectError = () => {
      if (!offlineTimer) {
        offlineTimer = setTimeout(() => {
          setIsOffline(true);
        }, 3000);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      if (offlineTimer) clearTimeout(offlineTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: Platform.OS === 'web' ? 0 : 36,
        left: 0,
        right: 0,
        zIndex: 999999,
      }}
      className="bg-amber-600 px-4 py-2 flex-row items-center justify-center gap-2 shadow-md"
    >
      <Text className="text-white text-xs">⚠️</Text>
      <Text className="text-white text-xs font-bold text-center">
        Sin conexión a internet • Reconectando con DOMY...
      </Text>
    </View>
  );
};
