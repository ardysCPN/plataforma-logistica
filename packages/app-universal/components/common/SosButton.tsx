import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { UniversalDialog } from './UniversalDialog';
import { Button } from './Button';

interface SosButtonProps {
  orderId: string;
  className?: string;
}

export const SosButton: React.FC<SosButtonProps> = ({ orderId, className = '' }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleCallPolice = () => {
    Linking.openURL('tel:123').catch(() => {
      Alert.alert('Error', 'No fue posible iniciar la llamada al 123');
    });
  };

  const handleShareTracking = () => {
    const trackingUrl = `https://domiapp.adhsolutions.tech/track/${orderId}`;
    const text = encodeURIComponent(
      `¡Hola! Estoy en un servicio activo y te comparto mi ubicación y trayecto en vivo por seguridad: ${trackingUrl}`
    );
    Linking.openURL(`https://wa.me/?text=${text}`).catch(() => {
      Alert.alert('Enlace copiado', trackingUrl);
    });
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        className={`bg-danger shadow-lg shadow-danger/40 px-3.5 py-2 rounded-full flex-row items-center gap-1.5 border border-red-300 ${className}`}
      >
        <Text className="text-white text-xs font-black tracking-wider">🆘 SOS</Text>
      </TouchableOpacity>

      <UniversalDialog
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        maxWidth={380}
      >
        <View className="items-center w-full">
          <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center mb-3">
            <Text className="text-3xl">🚨</Text>
          </View>

          <Text className="text-xl font-bold text-slate-900 mb-1 text-center">
            Centro de Asistencia y Seguridad
          </Text>
          <Text className="text-xs text-slate-500 mb-6 text-center leading-relaxed">
            Si te encuentras en una situación de riesgo, puedes contactar a las autoridades o alertar a tus contactos de confianza.
          </Text>

          <Button
            title="📞 Llamar a la Policía (123)"
            variant="danger"
            onPress={handleCallPolice}
            className="w-full mb-3"
          />

          <Button
            title="💬 Compartir Trayecto por WhatsApp"
            variant="secondary"
            onPress={handleShareTracking}
            className="w-full mb-4"
          />

          <Button
            title="Cerrar"
            variant="outline"
            onPress={() => setModalVisible(false)}
            className="w-full"
          />
        </View>
      </UniversalDialog>
    </>
  );
};
