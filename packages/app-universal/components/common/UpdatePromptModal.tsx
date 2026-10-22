import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { UniversalDialog } from './UniversalDialog';
import { VersionCheckResult } from '../../services/versionService';

interface UpdatePromptModalProps {
  visible: boolean;
  versionInfo: VersionCheckResult | null;
  onClose: () => void;
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  visible,
  versionInfo,
  onClose,
}) => {
  if (!versionInfo) return null;

  const handleDownload = () => {
    const url = versionInfo.apkDownloadUrl || 'https://domiapp.adhsolutions.tech/downloads/domy.apk';
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    });
    onClose();
  };

  return (
    <UniversalDialog visible={visible} onClose={onClose} maxWidth={390}>
      <View className="items-center p-2 text-center w-full">
        <View className="w-16 h-16 rounded-2xl bg-emerald-100 items-center justify-center mb-4 border border-emerald-200">
          <Text className="text-3xl">📲</Text>
        </View>

        <Text className="text-xl font-black text-slate-900 mb-1 text-center">
          Nueva Versión Disponible
        </Text>

        <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 mb-3">
          <Text className="text-xs font-bold text-emerald-800">
            v{versionInfo.currentVersion} → v{versionInfo.latestVersion}
          </Text>
        </View>

        <Text className="text-sm text-slate-600 mb-4 text-center leading-relaxed">
          Esta versión está desactualizada. ¿Deseas descargar la versión más reciente con mejoras en mapa, velocidad y estabilidad?
        </Text>

        {versionInfo.releaseNotes ? (
          <View className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-5">
            <Text className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Novedades:
            </Text>
            <Text className="text-xs text-slate-700">
              {versionInfo.releaseNotes}
            </Text>
          </View>
        ) : null}

        <View className="w-full gap-2.5">
          <TouchableOpacity
            onPress={handleDownload}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 items-center justify-center shadow-md active:bg-emerald-700 flex-row gap-2"
          >
            <Text className="text-white text-base">⬇️</Text>
            <Text className="text-sm font-black text-white">
              Descargar e Instalar APK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            className="w-full py-2.5 rounded-xl items-center justify-center active:opacity-70"
          >
            <Text className="text-xs font-bold text-slate-500">
              Recordar más tarde
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </UniversalDialog>
  );
};
