import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { UniversalDialog } from './UniversalDialog';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'primary';
  icon?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'primary',
  icon,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const defaultIcon = type === 'danger' ? '⚠️' : type === 'warning' ? '🔔' : 'ℹ️';
  const displayIcon = icon || defaultIcon;

  const confirmBg =
    type === 'danger'
      ? 'bg-rose-600 active:bg-rose-700'
      : type === 'warning'
      ? 'bg-amber-600 active:bg-amber-700'
      : 'bg-primary active:bg-primary-dark';

  return (
    <UniversalDialog visible={visible} onClose={onCancel} maxWidth={380}>
      <View className="items-center p-2 text-center w-full">
        <View
          className={`w-14 h-14 rounded-2xl items-center justify-center mb-4 ${
            type === 'danger'
              ? 'bg-rose-100'
              : type === 'warning'
              ? 'bg-amber-100'
              : 'bg-primary/10'
          }`}
        >
          <Text className="text-2xl">{displayIcon}</Text>
        </View>

        <Text className="text-lg font-black text-slate-900 mb-2 text-center">
          {title}
        </Text>

        <Text className="text-sm text-slate-600 mb-6 text-center leading-relaxed">
          {message}
        </Text>

        <View className="w-full flex-row gap-3">
          <TouchableOpacity
            onPress={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-slate-100 items-center justify-center active:bg-slate-200"
          >
            <Text className="text-sm font-bold text-slate-700">{cancelText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-2xl items-center justify-center shadow-sm ${confirmBg}`}
          >
            <Text className="text-sm font-bold text-white">
              {loading ? 'Procesando...' : confirmText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </UniversalDialog>
  );
};
