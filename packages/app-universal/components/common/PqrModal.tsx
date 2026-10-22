import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Platform, Linking, ScrollView } from 'react-native';
import { UniversalBottomSheet } from './UniversalBottomSheet';
import { Button } from './Button';
import { api } from '../../services/api';

interface PqrModalProps {
  visible: boolean;
  orderId?: string | null;
  isCourier?: boolean;
  onClose: () => void;
  onOpenHistory?: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: 'DAMAGE_OR_LOSS', label: '🎒 Objeto Olvidado en el Vehículo' },
  { id: 'PRICE_DISPUTE', label: '💰 Disputa o Cobro Inexacto' },
  { id: 'INAPPROPRIATE_BEHAVIOR', label: '⚠️ Comportamiento Inapropiado' },
  { id: 'SECURITY_CONCERN', label: '🚨 Seguridad o Conducción Riesgosa' },
  { id: 'UNCOMPLETED_DELIVERY', label: '📦 Pedido Incompleto / No Entregado' },
  { id: 'OTHER', label: '📝 Otro Motivo' },
];

const SUPPORT_WHATSAPP = 'https://wa.me/573000000000?text=' + encodeURIComponent('Hola equipo de soporte DOMY, necesito asistencia con la plataforma.');
const EMERGENCY_PHONE = 'tel:123';

export const PqrModal: React.FC<PqrModalProps> = ({
  visible,
  orderId,
  isCourier = false,
  onClose,
  onOpenHistory,
  onSuccess,
}) => {
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const hasSpecificOrder = Boolean(orderId && orderId.trim().length > 0);

  const handleSubmit = async () => {
    if (!hasSpecificOrder) return;

    if (description.trim().length < 5) {
      const msg = 'Por favor describe el motivo del reporte con al menos 5 caracteres.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Aviso', msg);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/api/orders/${orderId}/pqr`, {
        category,
        description: description.trim(),
      });

      const successMsg = res.data.message || 'Reporte radicado con éxito. Nuestro equipo lo revisará en breve.';
      if (Platform.OS === 'web') alert(`✅ ${successMsg}`);
      else Alert.alert('Reporte Radicado', successMsg);

      setDescription('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo radicar el reporte';
      if (Platform.OS === 'web') alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWhatsApp = () => {
    Linking.openURL(SUPPORT_WHATSAPP).catch(() => {
      Alert.alert('Soporte', 'Escríbenos a contacto@adhsolutions.tech');
    });
  };

  const handleCallEmergency = () => {
    Linking.openURL(EMERGENCY_PHONE).catch(() => {
      Alert.alert('Emergencias', 'Marca 123 desde tu teléfono');
    });
  };

  return (
    <UniversalBottomSheet visible={visible} onClose={onClose} maxHeight="90%">
      <View className="p-6 flex-1">
          {/* Encabezado */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View>
              <Text className="text-lg font-black text-slate-900">
                🛡️ Centro de Ayuda y PQR
              </Text>
              <Text className="text-xs text-slate-500">
                {hasSpecificOrder ? `Reporte para el servicio #${orderId?.slice(0, 8)}` : 'Atención al usuario y soporte 24/7'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center active:bg-slate-200"
            >
              <Text className="text-slate-600 font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {hasSpecificOrder ? (
              // Formulario específico para un servicio
              <>
                <Text className="text-xs font-bold text-slate-700 mb-2">Motivo del Reporte:</Text>
                <View className="gap-1.5 mb-4">
                  {CATEGORIES.map((c) => {
                    const selected = category === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setCategory(c.id)}
                        className={`p-2.5 rounded-xl border flex-row items-center justify-between ${
                          selected ? 'border-primary bg-primary/10' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-slate-700'}`}>
                          {c.label}
                        </Text>
                        {selected && <Text className="text-xs text-primary font-bold">✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text className="text-xs font-bold text-slate-700 mb-1">Detalles de lo Sucedido:</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe qué ocurrió, objeto olvidado o motivo de tu reporte..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 mb-4"
                />

                <View className="flex-row gap-2">
                  <Button
                    title="Cancelar"
                    variant="outline"
                    onPress={onClose}
                    className="flex-1 py-2.5"
                    disabled={loading}
                  />
                  <Button
                    title="Enviar Reporte"
                    variant="primary"
                    onPress={handleSubmit}
                    loading={loading}
                    className="flex-1 py-2.5"
                  />
                </View>
              </>
            ) : (
              // Centro de Ayuda General cuando no hay pedido activo seleccionado
              <View className="gap-3">
                <View className="bg-orange-50 border border-orange-200 rounded-2xl p-4 items-center text-center">
                  <Text className="text-3xl mb-1">🎧</Text>
                  <Text className="text-sm font-black text-slate-800 text-center">
                    ¿En qué podemos ayudarte hoy?
                  </Text>
                  <Text className="text-xs text-slate-600 text-center mt-1">
                    Nuestro equipo de atención al cliente está siempre listo para resolver tus dudas o atender emergencias.
                  </Text>
                </View>

                {/* Botón WhatsApp */}
                <TouchableOpacity
                  onPress={handleOpenWhatsApp}
                  activeOpacity={0.8}
                  className="bg-emerald-600 p-3.5 rounded-2xl flex-row items-center justify-between shadow-sm active:bg-emerald-700"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Text className="text-2xl">💬</Text>
                    <View>
                      <Text className="text-white text-xs font-black">Chat de Soporte por WhatsApp</Text>
                      <Text className="text-emerald-100 text-[11px]">Respuesta rápida en minutos</Text>
                    </View>
                  </View>
                  <Text className="text-white font-bold text-sm">→</Text>
                </TouchableOpacity>

                {/* Botón Emergencia 123 */}
                <TouchableOpacity
                  onPress={handleCallEmergency}
                  activeOpacity={0.8}
                  className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Text className="text-2xl">🚨</Text>
                    <View>
                      <Text className="text-rose-800 text-xs font-black">Línea de Emergencias 123</Text>
                      <Text className="text-rose-600 text-[11px]">Policía y auxilio nacional</Text>
                    </View>
                  </View>
                  <Text className="text-rose-700 font-bold text-sm">📞</Text>
                </TouchableOpacity>

                {/* Botón Reportar Servicio desde Historial */}
                {onOpenHistory && (
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onOpenHistory();
                    }}
                    activeOpacity={0.8}
                    className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex-row items-center justify-between active:bg-slate-100"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Text className="text-2xl">📜</Text>
                      <View>
                        <Text className="text-slate-800 text-xs font-black">Reportar un Viaje Anterior</Text>
                        <Text className="text-slate-500 text-[11px]">Selecciona el viaje desde tu historial</Text>
                      </View>
                    </View>
                    <Text className="text-slate-600 font-bold text-sm">→</Text>
                  </TouchableOpacity>
                )}

                <Button
                  title="Cerrar"
                  variant="outline"
                  onPress={onClose}
                  className="w-full mt-2 py-2.5"
                />
              </View>
            )}
          </ScrollView>
      </View>
    </UniversalBottomSheet>
  );
};
