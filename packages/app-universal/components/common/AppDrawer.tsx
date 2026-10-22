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
  Image,
  Linking,
  Alert,
} from 'react-native';
import { versionService, VersionCheckResult, CURRENT_APP_VERSION } from '../../services/versionService';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  isCourier?: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenProfile?: () => void;
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
  onOpenProfile,
  onOpenChats,
  onOpenHistory,
  onOpenDestinationMode,
  onOpenPqr,
  onOpenWallet,
  onLogout,
  unreadChatsCount = 0,
}) => {
  const [shouldRender, setShouldRender] = useState(visible);
  const [versionResult, setVersionResult] = useState<VersionCheckResult | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = Math.min(screenWidth * 0.82, 340);

  const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      versionService.checkVersion().then((res) => setVersionResult(res)).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
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

  // Ejecución segura de acciones con retraso sutil para evitar colisión de animación
  const handleItemPress = (action?: () => void) => {
    if (!action) return;
    onClose();
    setTimeout(() => {
      action();
    }, 120);
  };

  const handleDownloadApk = () => {
    const downloadUrl = versionResult?.apkDownloadUrl || 'https://domiapp.adhsolutions.tech/downloads/domy.apk';
    const isOutdated = versionResult?.isOutdated;
    const title = isOutdated ? 'Nueva Versión Disponible' : 'Descargar Instalador APK';
    const message = isOutdated
      ? `Hay una versión más reciente (v${versionResult?.latestVersion}). ¿Deseas descargar el instalador oficial (domy.apk) ahora?`
      : `Versión actual instalada: v${CURRENT_APP_VERSION}.\n\n¿Deseas descargar el archivo instalador oficial (domy.apk) a tu dispositivo?`;

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descargar APK',
          style: 'default',
          onPress: () => {
            Linking.openURL(downloadUrl).catch((err) => {
              Alert.alert('Error', 'No fue posible abrir el enlace de descarga: ' + (err?.message || downloadUrl));
            });
          },
        },
      ]
    );
  };

  if (!shouldRender && !visible) {
    return null;
  }

  return (
    <View style={styles.overlayContainer} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Fondo oscuro traslúcido: pointerEvents='none' para que no intercepte clics de los botones */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            opacity: fadeAnim,
          },
        ]}
      />

      {/* Disposición en fila: El panel está a la izquierda y el área de toque para cerrar a la derecha */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Panel Lateral Animado (Ocupa únicamente su ancho correspondiente) */}
        <Animated.View
          style={[
            {
              width: drawerWidth,
              height: '100%',
              transform: [{ translateX: slideAnim }],
              zIndex: 10,
              elevation: 10,
            },
          ]}
        >
          <View className="flex-1 bg-white dark:bg-slate-900 shadow-2xl flex-col">
            <ScrollView
              className="flex-1"
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Encabezado del Perfil */}
              <View className="bg-secondary p-6 pt-12 pb-6">
                <View className="flex-row items-center justify-between mb-4">
                  <TouchableOpacity
                    onPress={() => onOpenProfile && handleItemPress(onOpenProfile)}
                    activeOpacity={0.8}
                    className="relative"
                  >
                    {user?.avatarUrl ? (
                      <Image
                        source={{ uri: user.avatarUrl }}
                        className="w-14 h-14 rounded-full border-2 border-primary"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary items-center justify-center">
                        <Text className="text-xl font-black text-primary">
                          {user?.fullName?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                    <View className="absolute bottom-0 right-0 bg-primary w-5 h-5 rounded-full items-center justify-center border border-white">
                      <Text className="text-[10px] text-white">✏️</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onClose}
                    className="w-8 h-8 rounded-full bg-white/10 items-center justify-center active:bg-white/20"
                  >
                    <Text className="text-white font-bold">✕</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => onOpenProfile && handleItemPress(onOpenProfile)}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-black text-lg" numberOfLines={1}>
                    {user?.fullName || user?.name || 'Usuario'}
                  </Text>
                  <Text className="text-slate-300 text-xs mt-0.5">
                    {user?.phone || user?.email || 'Cuenta Activa'}
                  </Text>
                </TouchableOpacity>

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
                        onPress={() => handleItemPress(onOpenWallet)}
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
                {onOpenProfile && (
                  <TouchableOpacity
                    onPress={() => handleItemPress(onOpenProfile)}
                    className="flex-row items-center gap-3 p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
                  >
                    <Text className="text-xl">👤</Text>
                    <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Mi Perfil
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleItemPress(onOpenChats)}
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
                  onPress={() => handleItemPress(onOpenHistory)}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <Text className="text-xl">📜</Text>
                  <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Historial de Viajes
                  </Text>
                </TouchableOpacity>

                {isCourier && onOpenDestinationMode && (
                  <TouchableOpacity
                    onPress={() => handleItemPress(onOpenDestinationMode)}
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
                  onPress={() => handleItemPress(onOpenPqr)}
                  className="flex-row items-center gap-3 p-3.5 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <Text className="text-xl">🚨</Text>
                  <Text className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Soporte & Reportar PQR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleItemPress(handleDownloadApk)}
                  className="flex-row items-center justify-between p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 active:bg-emerald-500/20 mt-1"
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl">📲</Text>
                    <View>
                      <Text className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        Descargar / Actualizar APK
                      </Text>
                      <Text className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Instalador Android directo (.apk)
                      </Text>
                    </View>
                  </View>
                  <Text className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">↓</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Botón Salir en Footer */}
            <View className="p-5 border-t border-slate-100 dark:border-slate-800">
              <TouchableOpacity
                onPress={() => handleItemPress(onLogout)}
                className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 py-3 rounded-2xl flex-row items-center justify-center gap-2 active:bg-red-100"
              >
                <Text className="text-red-600 dark:text-red-400 font-bold text-sm">🚪 Cerrar Sesión</Text>
              </TouchableOpacity>

              {/* Indicador de Versión & Actualización */}
              <TouchableOpacity
                onPress={handleDownloadApk}
                activeOpacity={0.7}
                className="mt-3 items-center"
              >
                {versionResult?.isOutdated ? (
                  <View className="bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 active:bg-rose-500/20">
                    <Text className="text-xs">🔴</Text>
                    <Text className="text-[11px] font-bold text-rose-500">
                      Desactualizado • Descargar v{versionResult.latestVersion}
                    </Text>
                  </View>
                ) : (
                  <View className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                    <Text className="text-[10px] text-emerald-500 font-bold">●</Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      v{CURRENT_APP_VERSION} • Toca para descargar APK
                    </Text>
                  </View>
                )}

                <Text className="text-[10px] text-slate-400 text-center mt-1 font-semibold">
                  DOMY • Plataforma Logística
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Zona exterior a la derecha para tocar y cerrar el menú (sin superposición en los botones) */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{ flex: 1, height: '100%' }}
          accessibilityLabel="Cerrar menú"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 30,
  },
});
