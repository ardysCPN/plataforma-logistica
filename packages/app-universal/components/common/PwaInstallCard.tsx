import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, Image } from 'react-native';

interface PwaInstallCardProps {
  variant?: 'card' | 'compact' | 'drawer';
}

export const PwaInstallCard: React.FC<PwaInstallCardProps> = ({ variant = 'card' }) => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Verificar si ya está ejecutándose como PWA instalada
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detectar iOS Safari y Android
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);

    if ((window as any).__domyInstallPrompt) {
      setCanInstall(true);
    }

    const handleCanInstall = () => setCanInstall(true);
    const handleInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setShowGuideModal(false);
    };

    window.addEventListener('domy:can-install', handleCanInstall);
    window.addEventListener('domy:installed', handleInstalled);

    return () => {
      window.removeEventListener('domy:can-install', handleCanInstall);
      window.removeEventListener('domy:installed', handleInstalled);
    };
  }, []);

  // Si no estamos en web o ya está instalada, no mostrar o mostrar badge
  if (Platform.OS !== 'web' || isInstalled) {
    if (isInstalled && variant === 'drawer') {
      return (
        <View className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl flex-row items-center gap-2">
          <Text className="text-sm">✅</Text>
          <Text className="text-xs font-bold text-emerald-400">App Instalada en este equipo</Text>
        </View>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const promptEvent = (window as any).__domyInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        (window as any).__domyInstallPrompt = null;
      }
    } else {
      // Si el navegador no permite disparo programático (ej. Safari iOS o Chrome desktop ya evaluado)
      setShowGuideModal(true);
    }
  };

  if (variant === 'drawer') {
    return (
      <>
        <TouchableOpacity
          onPress={handleInstallClick}
          className="bg-primary/10 border border-primary/30 p-3.5 rounded-2xl flex-row items-center justify-between active:bg-primary/20"
        >
          <View className="flex-row items-center gap-2.5">
            <View className="w-8 h-8 rounded-xl bg-primary items-center justify-center">
              <Text className="text-white text-base">📲</Text>
            </View>
            <View>
              <Text className="text-white font-bold text-xs">Instalar Aplicación</Text>
              <Text className="text-slate-400 text-[10px]">Acceso nativo en tu pantalla</Text>
            </View>
          </View>
          <View className="bg-primary px-2.5 py-1 rounded-lg">
            <Text className="text-white text-[10px] font-extrabold uppercase">Instalar</Text>
          </View>
        </TouchableOpacity>

        {/* Modal de Instrucciones de Instalación */}
        {renderGuideModal()}
      </>
    );
  }

  return (
    <>
      <View className="bg-gradient-to-r from-slate-900 to-slate-800 border-2 border-primary/30 rounded-3xl p-5 my-4 shadow-lg overflow-hidden relative">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-1.5 mb-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Text className="text-[10px] font-black uppercase tracking-wider text-primary">
                Aplicación Web Progresiva (PWA)
              </Text>
            </View>
            <Text className="text-white font-extrabold text-base mb-1">
              📲 Instala DOMY en tu dispositivo
            </Text>
            <Text className="text-slate-300 text-xs leading-relaxed">
              Úsala como una App nativa en Android, iPhone o PC. Acceso con un toque, más rápida y sin barras de navegación.
            </Text>
          </View>
          <View className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 items-center justify-center shadow-md">
            <Text className="text-2xl">⚡</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleInstallClick}
          className="mt-4 bg-primary hover:bg-primary/90 active:bg-primary/80 py-3 px-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-md"
        >
          <Text className="text-white font-black text-sm">
            {canInstall ? '⚡ Instalar Aplicación Ahora' : '📲 Ver Cómo Instalar en este Equipo'}
          </Text>
        </TouchableOpacity>

        {isAndroid && (
          <TouchableOpacity
            onPress={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/downloads/domy.apk';
              }
            }}
            className="mt-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 py-2.5 px-4 rounded-2xl flex-row items-center justify-center gap-2"
          >
            <Text className="text-emerald-400 font-extrabold text-xs">🤖 O descarga directamente el APK de Android</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderGuideModal()}
    </>
  );

  function renderGuideModal() {
    return (
      <Modal visible={showGuideModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/75 justify-end sm:justify-center p-4">
          <View className="bg-white rounded-3xl max-w-md w-full self-center p-6 shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">📲</Text>
                <Text className="text-lg font-black text-slate-900">
                  {isIOS ? 'Instalar en iPhone / iPad' : 'Instalar en Android o PC'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <Text className="text-slate-600 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {isIOS ? (
              <View className="space-y-3">
                <Text className="text-xs text-slate-600 mb-2">
                  Apple Safari requiere añadir la app manualmente a la pantalla de inicio en 3 sencillos pasos:
                </Text>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex-row items-center gap-3">
                  <Text className="text-xl">1️⃣</Text>
                  <Text className="text-xs text-slate-700 flex-1">
                    Toca el botón <Text className="font-black text-blue-600">Compartir ⎋</Text> en la barra inferior de Safari.
                  </Text>
                </View>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex-row items-center gap-3">
                  <Text className="text-xl">2️⃣</Text>
                  <Text className="text-xs text-slate-700 flex-1">
                    Desliza hacia abajo y selecciona <Text className="font-black text-slate-900">"Agregar a pantalla de inicio" ➕</Text>.
                  </Text>
                </View>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex-row items-center gap-3">
                  <Text className="text-xl">3️⃣</Text>
                  <Text className="text-xs text-slate-700 flex-1">
                    Toca <Text className="font-black text-primary">"Agregar"</Text> en la esquina superior derecha y ¡listo!
                  </Text>
                </View>
              </View>
            ) : (
              <View className="space-y-3">
                <Text className="text-xs text-slate-600 mb-2">
                  Si tu navegador no abrió la ventana automática, sigue estos pasos:
                </Text>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex-row items-center gap-3">
                  <Text className="text-xl">1️⃣</Text>
                  <Text className="text-xs text-slate-700 flex-1">
                    Abre el menú de tu navegador tocando los <Text className="font-black text-slate-900">tres puntos ⋮</Text> (arriba o abajo).
                  </Text>
                </View>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex-row items-center gap-3">
                  <Text className="text-xl">2️⃣</Text>
                  <Text className="text-xs text-slate-700 flex-1">
                    Selecciona <Text className="font-black text-primary">"Instalar aplicación"</Text> o <Text className="font-black text-slate-900">"Agregar a la pantalla principal"</Text>.
                  </Text>
                </View>
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex-row items-center gap-3">
                  <Text className="text-xl">3️⃣</Text>
                  <Text className="text-xs text-slate-700 flex-1">
                    Confirma <Text className="font-black text-emerald-600">"Instalar"</Text>. DOMY se añadirá como app nativa a tu escritorio o celular.
                  </Text>
                </View>

                {/* Opción de descarga directa de APK nativo */}
                <View className="pt-3 border-t border-slate-200 mt-2">
                  <Text className="text-[11px] font-black uppercase text-slate-500 mb-2">
                    ¿Deseas el archivo instalador nativo (.apk)?
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowGuideModal(false);
                      if (typeof window !== 'undefined') {
                        window.location.href = '/downloads/domy.apk';
                      }
                    }}
                    className="bg-emerald-600 active:bg-emerald-700 py-3 rounded-xl flex-row items-center justify-center gap-2 shadow"
                  >
                    <Text className="text-white font-extrabold text-xs">🤖 Descargar Archivo APK (.apk)</Text>
                  </TouchableOpacity>
                  <Text className="text-[10px] text-slate-400 text-center mt-1">
                    Requiere permitir "Instalar aplicaciones desconocidas" en Android.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setShowGuideModal(false)}
              className="mt-5 bg-slate-900 py-3 rounded-2xl items-center"
            >
              <Text className="text-white font-bold text-xs">Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
};
