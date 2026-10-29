import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { UniversalBottomSheet } from '../common/UniversalBottomSheet';
import { api } from '../../services/api';
import { formatServiceType } from '../../utils/formatters';

interface RatingItem {
  id: string;
  score: number;
  feedbackTags: string[];
  comment: string;
  serviceType: string;
  createdAt: string;
}

interface RatingsResponse {
  averageRating: number;
  totalRatings: number;
  breakdown: { [score: number]: number };
  ratings: RatingItem[];
}

interface RatingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const TAG_LABELS: Record<string, string> = {
  PUNTUAL: '⏱️ Muy puntual',
  AMABLE: '🤝 Amable y respetuoso',
  BUEN_ESTADO: '📦 Entrega impecable',
  VEHICULO_LIMPIO: '✨ Vehículo limpio',
  BUENA_COMUNICACION: '💬 Buena comunicación',
  MANEJO_SEGURO: '🛡️ Conducción segura',
  RAPIDO: '⚡ Muy rápido',
};

export const RatingsModal: React.FC<RatingsModalProps> = ({ visible, onClose }) => {
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchRatings();
    }
  }, [visible]);

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const res = await api.get<RatingsResponse>('/api/orders/courier/ratings');
      setData(res.data);
    } catch (err) {
      console.warn('Error cargando calificaciones del conductor:', err);
    } finally {
      setLoading(false);
    }
  };

  const avg = data?.averageRating || 5.0;
  const total = data?.totalRatings || 0;
  const breakdown = data?.breakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const ratings = data?.ratings || [];

  return (
    <UniversalBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="92%"
      height={Platform.OS === 'web' ? '88%' : '90%'}
    >
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between border-b border-slate-100 mb-2">
        <View>
          <Text className="text-lg font-black text-slate-900">⭐ Mis Calificaciones</Text>
          <Text className="text-xs text-slate-500">Reputación y comentarios de clientes</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
        >
          <Text className="text-slate-600 font-bold text-sm">✕</Text>
        </TouchableOpacity>
      </View>
      {loading && !data ? (
        <View className="py-20 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text className="text-slate-400 text-sm font-medium mt-3">
            Cargando tus valoraciones...
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 py-2"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Tarjeta Principal de Puntuación Promedio */}
          <View className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 mb-5 shadow-lg border border-amber-400/40">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-amber-100 uppercase tracking-wider mb-1">
                  Tu Reputación
                </Text>
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-4xl font-black text-white">
                    {avg.toFixed(1)}
                  </Text>
                  <Text className="text-lg font-bold text-amber-100">
                    / 5.0
                  </Text>
                </View>
                <View className="flex-row items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Text key={star} className="text-base text-yellow-300">
                      {star <= Math.round(avg) ? '★' : '☆'}
                    </Text>
                  ))}
                </View>
              </View>

              <View className="items-end">
                <View className="bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md mb-2">
                  <Text className="text-xs font-black text-white">
                    {avg >= 4.8
                      ? '🏆 Conductor Élite'
                      : avg >= 4.5
                      ? '⭐ Conductor Destacado'
                      : '👍 Buen Desempeño'}
                  </Text>
                </View>
                <Text className="text-xs text-amber-100 font-medium">
                  {total} {total === 1 ? 'calificación' : 'calificaciones'}
                </Text>
              </View>
            </View>

            {/* Barras de distribución de 5 a 1 estrellas */}
            <View className="mt-5 pt-4 border-t border-white/20">
              <Text className="text-[11px] font-bold text-amber-100 uppercase mb-2">
                Desglose por estrellas
              </Text>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = breakdown[stars] || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <View key={stars} className="flex-row items-center gap-2 mb-1.5">
                    <Text className="text-xs font-bold text-white w-7">
                      {stars} ★
                    </Text>
                    <View className="flex-1 h-2.5 bg-white/25 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-white rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </View>
                    <Text className="text-xs text-amber-100 font-semibold w-7 text-right">
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Encabezado de la lista de comentarios */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-slate-800">
              Comentarios y Reseñas
            </Text>
            <TouchableOpacity
              onPress={fetchRatings}
              className="bg-slate-100 px-3 py-1 rounded-full active:bg-slate-200"
            >
              <Text className="text-xs font-medium text-slate-600">↻ Actualizar</Text>
            </TouchableOpacity>
          </View>

          {/* Listado de comentarios */}
          {ratings.length === 0 ? (
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-8 items-center justify-center my-2">
              <Text className="text-3xl mb-2">✨</Text>
              <Text className="text-sm font-bold text-slate-700 text-center">
                Aún no tienes comentarios
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1 leading-relaxed">
                Continúa realizando servicios con excelente atención para recibir calificaciones y comentarios de tus clientes.
              </Text>
            </View>
          ) : (
            ratings.map((item) => (
              <View
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-sm"
              >
                {/* Cabecera de la reseña: estrellas, tipo de servicio y fecha */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Text
                        key={s}
                        className={`text-sm ${
                          s <= item.score ? 'text-amber-400' : 'text-slate-200'
                        }`}
                      >
                        ★
                      </Text>
                    ))}
                    <Text className="text-xs font-bold text-slate-700 ml-1">
                      {item.score}.0
                    </Text>
                  </View>
                  <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                    <Text className="text-[10px] font-semibold text-slate-600">
                      {formatServiceType(item.serviceType)}
                    </Text>
                  </View>
                </View>

                {/* Comentario del cliente si existe */}
                {item.comment ? (
                  <Text className="text-sm text-slate-700 leading-relaxed my-1">
                    "{item.comment}"
                  </Text>
                ) : (
                  <Text className="text-xs text-slate-400 italic my-1">
                    Sin comentario escrito.
                  </Text>
                )}

                {/* Etiquetas de retroalimentación recibidas */}
                {item.feedbackTags && item.feedbackTags.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5 mt-2">
                    {item.feedbackTags.map((tag, idx) => (
                      <View
                        key={idx}
                        className="bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5"
                      >
                        <Text className="text-[10px] font-medium text-emerald-700">
                          {TAG_LABELS[tag] || tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Pie de la reseña: autor anónimo y fecha */}
                <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <Text className="text-[11px] text-slate-400 font-medium">
                    👤 Cliente verificado de DOMY
                  </Text>
                  <Text className="text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </UniversalBottomSheet>
  );
};
