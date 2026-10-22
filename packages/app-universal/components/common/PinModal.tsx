import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Button } from './Button';

interface PinModalProps {
  visible: boolean;
  onVerify: (pin: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const PinModal: React.FC<PinModalProps> = ({
  visible,
  onVerify,
  onCancel,
  loading = false,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('El PIN debe tener exactamente 4 dígitos');
      return;
    }
    setError(null);
    try {
      await onVerify(pin);
      setPin('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PIN incorrecto');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/70 px-4">
        {/* Backdrop dismiss */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onCancel}
          className="absolute inset-0"
        />

        <View className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl items-center z-10">
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-3">
            <Text className="text-2xl">🔐</Text>
          </View>

          <Text className="text-xl font-bold text-slate-900 mb-1 text-center">
            Código PIN de Entrega
          </Text>
          <Text className="text-sm text-slate-500 mb-6 text-center">
            Pide al cliente el código de 4 dígitos que aparece en su pantalla para finalizar la entrega.
          </Text>

          <TextInput
            value={pin}
            onChangeText={(val) => {
              setPin(val.replace(/\D/g, '').slice(0, 4));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="••••"
            placeholderTextColor="#CBD5E1"
            className="w-48 text-center text-4xl font-extrabold tracking-[16px] text-slate-900 border-2 border-primary/50 focus:border-primary rounded-xl py-3 px-4 bg-slate-50 mb-3"
            autoFocus
          />

          {error ? (
            <Text className="text-danger text-xs font-semibold mb-4 text-center">
              {error}
            </Text>
          ) : (
            <View className="h-4 mb-2" />
          )}

          <View className="w-full flex-row gap-3">
            <Button
              title="Cancelar"
              variant="outline"
              onPress={onCancel}
              className="flex-1"
              disabled={loading}
            />
            <Button
              title="Confirmar"
              variant="primary"
              onPress={handleVerify}
              loading={loading}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
