import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { UniversalBottomSheet } from './UniversalBottomSheet';

export interface CourierDetailInfo {
  courierId: string;
  name: string;
  avatarUrl?: string | null;
  rating?: number;
  completedOrders?: number;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
}

interface CourierDetailModalProps {
  visible: boolean;
  courier: CourierDetailInfo | null;
  onClose: () => void;
  onSelectBid?: () => void;
  isOfferSelection?: boolean;
  bidPrice?: number;
}

export const CourierDetailModal: React.FC<CourierDetailModalProps> = ({
  visible,
  courier,
  onClose,
  onSelectBid,
  isOfferSelection = false,
  bidPrice,
}) => {
  if (!courier) return null;

  const vehicleIcon = courier.vehicleType === 'CAR' ? '🚗' : courier.vehicleType === 'VAN' ? '🚐' : '🛵';
  const vehicleLabel = courier.vehicleType === 'CAR' ? 'Carro / Automóvil' : courier.vehicleType === 'VAN' ? 'Furgoneta / Camión' : 'Motocicleta';

  return (
    <UniversalBottomSheet visible={visible} onClose={onClose} maxHeight="90%">
      <View className="p-6 flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View>
              <Text className="text-xl font-black text-slate-900">🛵 Perfil del Conductor</Text>
              <Text className="text-xs text-slate-500">Información verificada para tu seguridad</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 bg-slate-100 rounded-full items-center justify-center active:bg-slate-200"
            >
              <Text className="text-slate-600 font-bold text-base">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Cabecera del Conductor: Foto y Datos Principales */}
            <View className="items-center justify-center py-2">
              <View className="relative mb-3">
                {courier.avatarUrl ? (
                  <Image
                    source={{ uri: courier.avatarUrl }}
                    className="w-28 h-28 rounded-full border-4 border-primary shadow-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-28 h-28 rounded-full bg-slate-800 border-4 border-primary items-center justify-center shadow-lg">
                    <Text className="text-4xl font-black text-white">
                      {(courier.name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View className="absolute bottom-0 right-0 bg-emerald-500 w-8 h-8 rounded-full border-2 border-white items-center justify-center shadow">
                  <Text className="text-white text-xs">✓</Text>
                </View>
              </View>

              <Text className="text-2xl font-black text-slate-900 text-center">{courier.name}</Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <Text className="text-amber-500 text-base">⭐</Text>
                <Text className="text-sm font-bold text-slate-800">
                  {(courier.rating || 5.0).toFixed(1)}
                </Text>
                <Text className="text-xs text-slate-400">
                  • {courier.completedOrders || 0} servicios realizados
                </Text>
              </View>

              <View className="mt-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex-row items-center gap-1">
                <Text className="text-emerald-700 text-xs font-bold">🛡️ Conductor Verificado Domy</Text>
              </View>
            </View>

            {/* Tarjeta de Identificación del Vehículo */}
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-5 my-4 space-y-3">
              <View className="flex-row items-center justify-between border-b border-slate-200 pb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-2xl">{vehicleIcon}</Text>
                  <View>
                    <Text className="text-xs font-bold text-slate-500 uppercase">Vehículo Asignado</Text>
                    <Text className="text-sm font-black text-slate-900">{vehicleLabel}</Text>
                  </View>
                </View>

                {/* Placa estilo colombiana */}
                {courier.vehiclePlate && (
                  <View className="bg-amber-300 border-2 border-slate-900 px-3.5 py-1.5 rounded-lg shadow-sm">
                    <Text className="text-slate-900 font-black text-sm tracking-widest text-center">
                      {courier.vehiclePlate.toUpperCase()}
                    </Text>
                    <Text className="text-[8px] font-bold text-slate-700 text-center uppercase tracking-tighter">
                      COLOMBIA
                    </Text>
                  </View>
                )}
              </View>

              {/* Marca y Modelo */}
              <View className="flex-row justify-between items-center pt-1">
                <Text className="text-xs font-bold text-slate-500">Modelo / Línea:</Text>
                <Text className="text-sm font-black text-slate-800">
                  {courier.vehicleModel || 'No especificado'}
                </Text>
              </View>

              {/* Color */}
              <View className="flex-row justify-between items-center">
                <Text className="text-xs font-bold text-slate-500">Color del Vehículo:</Text>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-3.5 h-3.5 rounded-full bg-slate-600 border border-slate-300" />
                  <Text className="text-sm font-bold text-slate-800">
                    {courier.vehicleColor || 'Estándar'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Seguridad y Confianza */}
            <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex-row items-start gap-2.5 mb-4">
              <Text className="text-lg">🔒</Text>
              <Text className="text-[11px] text-blue-900 flex-1 leading-4">
                Por tu seguridad, valida que la placa <Text className="font-bold">{courier.vehiclePlate || 'del vehículo'}</Text> y el conductor coincidan al momento del abordaje.
              </Text>
            </View>

            {/* Acciones */}
            {isOfferSelection && onSelectBid ? (
              <View className="pt-2 pb-4 space-y-2">
                <TouchableOpacity
                  onPress={() => {
                    onSelectBid();
                    onClose();
                  }}
                  className="bg-primary py-3.5 px-4 rounded-xl items-center shadow-lg active:opacity-90 flex-row justify-center gap-2"
                >
                  <Text className="text-white font-black text-base">
                    Aceptar Oferta {bidPrice ? `por $${bidPrice.toLocaleString('es-CO')}` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  className="bg-slate-100 py-3 rounded-xl items-center active:bg-slate-200"
                >
                  <Text className="text-slate-600 font-bold text-sm">Volver a las ofertas</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="pt-2 pb-4">
                <TouchableOpacity
                  onPress={onClose}
                  className="bg-slate-900 py-3.5 rounded-xl items-center shadow active:bg-slate-800"
                >
                  <Text className="text-white font-bold text-sm">Entendido</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
      </View>
    </UniversalBottomSheet>
  );
};
