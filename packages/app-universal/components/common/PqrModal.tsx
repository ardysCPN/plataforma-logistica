import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Button } from './Button';
import { api } from '../../services/api';

interface PqrModalProps {
  visible: boolean;
  orderId: string;
  isCourier?: boolean;
  onClose: () => void;
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

export const PqrModal: React.FC<PqrModalProps> = ({ visible, orderId, onClose, onSuccess }) => {
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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

      const successMsg = res.data.message || 'Reporte radicado con éxito. Nuestro equipo lo revisará.';
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-center items-center px-4">
        <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
          {/* Encabezado */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View>
              <Text className="text-lg font-black text-slate-900">
                🛡️ Soporte y Reportes PQR
              </Text>
              <Text className="text-xs text-slate-500">
                Objetos olvidados, seguridad o disputas de servicio
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center active:bg-slate-200"
            >
              <Text className="text-slate-600 font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Categorías */}
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

          {/* Descripción */}
          <Text className="text-xs font-bold text-slate-700 mb-1">Detalles de lo Sucedido:</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe qué ocurrió, descripción del objeto olvidado o motivo de tu queja..."
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
        </View>
      </View>
    </Modal>
  );
};
