import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';
import { PqrModal } from './PqrModal';

interface HistoryItem {
  id: string;
  serviceType: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  price: number;
  commissionAmount: number;
  createdAt: string;
  completedAt?: string;
  counterpartName: string;
  vehicleType?: string;
  vehiclePlate?: string;
  ratingReceived?: number | null;
  commentReceived?: string | null;
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  isCourier?: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ visible, onClose, isCourier = false }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPqrOrderId, setSelectedPqrOrderId] = useState<string | null>(null);


  useEffect(() => {
    if (visible) {
      setLoading(true);
      api
        .get<HistoryItem[]>('/api/orders/history')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setHistory(res.data);
          }
        })
        .catch((err) => console.warn('Error al cargar historial:', err))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[85%] flex-col p-5 shadow-2xl">
          {/* Encabezado */}
          <View className="flex-row items-center justify-between pb-4 border-b border-slate-100">
            <View>
              <Text className="text-xl font-black text-slate-900">
                {isCourier ? '📜 Historial de Recorridos' : '📜 Mis Pedidos y Viajes'}
              </Text>
              <Text className="text-xs text-slate-500">
                {isCourier ? 'Tus servicios completados y ganancias' : 'Tus servicios solicitados'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 bg-slate-100 rounded-full items-center justify-center active:bg-slate-200"
            >
              <Text className="text-slate-600 font-bold text-base">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Registros */}
          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {loading ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text className="text-xs text-slate-400 mt-2">Cargando registros...</Text>
              </View>
            ) : history.length === 0 ? (
              <View className="py-12 items-center">
                <Text className="text-4xl mb-2">📦</Text>
                <Text className="text-base font-bold text-slate-700">Aún no hay viajes registrados</Text>
                <Text className="text-xs text-slate-400 text-center mt-1 px-6">
                  Tus solicitudes completadas y calificaciones recibidas aparecerán aquí.
                </Text>
              </View>
            ) : (
              history.map((item) => {
                const isCompleted = item.status === 'COMPLETED';
                const isCancelled = item.status === 'CANCELLED';
                const dateFormatted = new Date(item.createdAt).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <View
                    key={item.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-3"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-sm">
                          {item.serviceType === 'DELIVERY' ? '📦' : item.serviceType === 'ERRAND' ? '🛒' : '🛵'}
                        </Text>
                        <Text className="text-xs font-black text-slate-800 uppercase">
                          {item.serviceType}
                        </Text>
                        <Text className="text-[11px] text-slate-400">• {dateFormatted}</Text>
                      </View>

                      <View
                        className={`px-2.5 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100'
                            : isCancelled
                            ? 'bg-rose-100'
                            : 'bg-amber-100'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-black uppercase ${
                            isCompleted
                              ? 'text-emerald-700'
                              : isCancelled
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Origen y Destino */}
                    <Text className="text-xs text-slate-600 mb-0.5" numberOfLines={1}>
                      De: <Text className="font-medium text-slate-800">{item.originAddress}</Text>
                    </Text>
                    <Text className="text-xs text-slate-600 mb-2.5" numberOfLines={1}>
                      A: <Text className="font-semibold text-slate-900">{item.destinationAddress}</Text>
                    </Text>

                    {/* Calificación y Comentarios recibidos */}
                    {item.ratingReceived && (
                      <View className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-2.5 flex-row items-start gap-2">
                        <Text className="text-sm">⭐</Text>
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-amber-900">
                            Calificación: {item.ratingReceived.toFixed(1)} / 5.0
                          </Text>
                          {item.commentReceived ? (
                            <Text className="text-[11px] text-amber-800 italic mt-0.5">
                              "{item.commentReceived}"
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )}

                    {/* Pie: Participante y Monto */}
                    <View className="flex-row items-center justify-between pt-2 border-t border-slate-200/60">
                      <Text className="text-xs text-slate-500 font-medium">
                        {isCourier ? `Cliente: ${item.counterpartName}` : `Conductor: ${item.counterpartName}`}
                      </Text>
                      <Text className="text-base font-black text-primary">
                        ${item.price?.toLocaleString()} COP
                      </Text>
                    </View>

                    {/* Botón de Reporte PQR / Objeto Olvidado */}
                    <TouchableOpacity
                      onPress={() => setSelectedPqrOrderId(item.id)}
                      className="mt-2 pt-2 border-t border-slate-200/50 flex-row items-center justify-between active:opacity-75"
                    >
                      <Text className="text-[11px] text-slate-400">¿Inconvenientes con el viaje?</Text>
                      <Text className="text-[11px] font-bold text-amber-700">⚠️ Reportar PQR / Objeto Olvidado</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Modal de PQR / Objetos Olvidados */}
          {selectedPqrOrderId && (
            <PqrModal
              visible={Boolean(selectedPqrOrderId)}
              orderId={selectedPqrOrderId}
              onClose={() => setSelectedPqrOrderId(null)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

