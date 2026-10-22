import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  BackHandler,
  Platform,
} from 'react-native';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  isCourier?: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenChats: () => void;
  onOpenHistory: () => void;
  onOpenDestinationMode?: () => void;
  onOpenPqr: () => void;
  onOpenWallet?: () => void;
  onLogout: () => void;
  unreadChatsCount?: number;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  visible,
  onClose,
  user,
  isCourier = false,
  darkMode,
  onToggleDarkMode,
  onOpenChats,
  onOpenHistory,
  onOpenDestinationMode,
  onOpenPqr,
  onOpenWallet,
  onLogout,
  unreadChatsCount = 0,
}) => {
  const [shouldRender, setShouldRender] = useState(visible);
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = Math.min(screenWidth * 0.82, 340);

  const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shouldRender) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -drawerWidth,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, drawerWidth]);

  // Manejo de botón 'Atrás' de Android para cerrar el drawer de forma natural
  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      onClose();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, onClose]);

  if (!shouldRender && !visible) {
    return null;
  }

  return (
    <View style={styles.overlayContainer} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Fondo oscuro traslúcido con toque para cerrar */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
          accessibilityLabel="Cerrar menú"
        />
      </Animated.View>

      {/* Panel Lateral Animado (Deslizamiento desde la izquierda) */}
      <Animated.View
        style={[
          styles.drawerPanel,
          {
            width: drawerWidth,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View className="flex-1 bg-white dark:bg-slate-900 shadow-2xl flex-col">
          <ScrollView className="flex-1" bounces={false} showsVerticalScrollIndicator={false}>
            {/* Encabezado del Perfil */}
            <View className="bg-secondary p-6 pt-12 pb-6">
              <View className="flex-row items-center justify-between mb-4">
                <View className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary items-center justify-center">
                  <Text className="text-xl font-black text-primary">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 items-center justify-center active:bg-white/20"
                >
                  <Text className="text-white font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-white font-black text-lg" numberOfLines={1}>
                {user?.fullName || 'Usuario'}
              </Text>
              <Text className="text-slate-300 text-xs mt-0.5">
                {user?.phone || user?.email || 'Cuenta Activa'}
              </Text>

              <View className="flex-row items-center gap-2 mt-2">
                <View className="bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
                  <Text className="text-[11px] font-bold text-emerald-300">
                    {isCourier ? '🛵 Conductor Verificado' : '👤 Cliente VIP'}
                  </Text>
                </View>
                <Text className="text-amber-400 text-xs font-bold">⭐ 5.0</Text>
              </View>
            </View>

            {/* Tarjeta de Billetera para Conductor */}
            {isCourier && (
              <View className="p-4 border-b border-slate-100 dark:border-slate-800">
                <View className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex-row items-center justify-between">
                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Saldo en Billetera
                    </Text>
                    <Text className="text-lg font-black text-primary">
                      ${user?.walletBalance?.toLocaleString() || 0} COP
                    </Text>
                  </View>
                  {onOpenWallet && (
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onOpenWallet();
                      }}
                      className="bg-primary px-3 py-1.5 rounded-xl active:bg-primary-dark"
                    >
                      <Text className="text-white font-bold text-xs">+ Recargar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Enlaces de Navegación del Menú */}
            <View className="p-4 gap-1.5">
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onOpenChats();
                }}
                className="flex-row items-center justify-between p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">💬</Text>
                  <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Bandeja de Mensajes
                  </Text>
                </View>
                {unreadChatsCount > 0 && (
                  <View className="bg-primary px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-black text-white">{unreadChatsCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onOpenHistory();
                }}
                className="flex-row items-center gap-3 p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
              >
                <Text className="text-xl">📜</Text>
                <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Historial de Viajes
                </Text>
              </TouchableOpacity>

              {isCourier && onOpenDestinationMode && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onOpenDestinationMode();
                  }}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <Text className="text-xl">🎯</Text>
                  <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Modo Destino (Hacia Casa)
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onToggleDarkMode}
                className="flex-row items-center justify-between p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">{darkMode ? '☀️' : '🌙'}</Text>
                  <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {darkMode ? 'Modo Día' : 'Modo Nocturno'}
                  </Text>
                </View>
                <View
                  className={`px-2.5 py-1 rounded-full border ${
                    darkMode ? 'bg-amber-400/20 border-amber-400' : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-amber-300">
                    {darkMode ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onOpenPqr();
                }}
                className="flex-row items-center gap-3 p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
              >
                <Text className="text-xl">🚨</Text>
                <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Soporte & Reportar PQR
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Botón Salir en Footer */}
          <View className="p-5 border-t border-slate-100 dark:border-slate-800">
            <TouchableOpacity
              onPress={() => {
                onClose();
                onLogout();
              }}
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 py-3 rounded-2xl flex-row items-center justify-center gap-2 active:bg-red-100"
            >
              <Text className="text-red-600 dark:text-red-400 font-bold text-sm">🚪 Cerrar Sesión</Text>
            </TouchableOpacity>

            <Text className="text-[10px] text-slate-400 text-center mt-3">
              DOMY • Plataforma Logística v1.0.2
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 30,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 100000,
    elevation: 35,
  },
});
