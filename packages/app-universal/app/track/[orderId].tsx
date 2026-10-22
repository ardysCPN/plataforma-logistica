import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { UniversalMap } from '../../components/map/UniversalMap';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { SOCKET_EVENTS, GeoPoint } from '@plataforma/shared';

interface PublicOrderData {
  orderId: string;
  serviceType: string;
  status: string;
  originAddress: string;
  originPoint: GeoPoint;
  destinationAddress: string;
  destinationPoint: GeoPoint;
  agreedPrice: number;
  createdAt: string;
  courier: {
    firstName: string;
    ratingAvg: number;
    vehicleType: string;
    vehiclePlate?: string | null;
    location?: { latitude: number; longitude: number; bearing?: number } | null;
  } | null;
}

export default function PublicTrackScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<PublicOrderData | null>(null);
  const [courierLocation, setCourierLocation] = useState<{ latitude: number; longitude: number; bearing?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;

    // Cargar datos del servicio público
    api
      .get<PublicOrderData>(`/api/orders/public-track/${orderId}`)
      .then((res) => {
        if (isMounted) {
          setOrder(res.data);
          if (res.data.courier?.location) {
            setCourierLocation({
              latitude: res.data.courier.location.latitude,
              longitude: res.data.courier.location.longitude,
            });
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la información de rastreo.');
          setLoading(false);
        }
      });

    // Unirse a la sala de sockets para telemetría en vivo
    const socket = getSocket();
    socket.emit('order:join', orderId);

    const handleFeed = (feed: { orderId: string; latitude: number; longitude: number; bearing?: number }) => {
      if (feed.orderId === orderId && isMounted) {
        setCourierLocation({ latitude: feed.latitude, longitude: feed.longitude, bearing: feed.bearing });
      }
    };

    const handleStatusChange = (payload: { orderId: string; newStatus: string }) => {
      if (payload.orderId === orderId && isMounted) {
        setOrder((prev) => (prev ? { ...prev, status: payload.newStatus } : null));
      }
    };

    socket.on(SOCKET_EVENTS.LOCATION_CLIENT_FEED, handleFeed);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGE, handleStatusChange);

    return () => {
      isMounted = false;
      socket.emit('order:leave', orderId);
      socket.off(SOCKET_EVENTS.LOCATION_CLIENT_FEED, handleFeed);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGE, handleStatusChange);
    };
  }, [orderId]);

  const handleShareWhatsApp = () => {
    const currentUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : `https://domiapp.adhsolutions.tech/track/${orderId}`;
    const text = encodeURIComponent(`📍 Sigue mi recorrido en tiempo real aquí: ${currentUrl}`);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${text}`;

    if (Platform.OS === 'web') {
      window.open(whatsappUrl, '_blank');
    } else {
      Linking.openURL(whatsappUrl).catch(() => {});
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text className="text-white font-bold text-base mt-4">Cargando telemetría en vivo...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center p-6">
        <Text className="text-4xl mb-3">📍</Text>
        <Text className="text-white font-black text-lg text-center mb-2">Servicio No Encontrado</Text>
        <Text className="text-slate-400 text-xs text-center">{error || 'El enlace de rastreo ha expirado o no es válido.'}</Text>
      </View>
    );
  }

  const isCompleted = order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED';

  return (
    <View className="flex-1 bg-slate-900">
      {/* Barra Superior */}
      <View className="px-5 py-4 pt-10 flex-row items-center justify-between border-b border-slate-800">
        <View>
          <View className="flex-row items-center gap-2">
            <View className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Text className="text-white font-black text-sm tracking-wide uppercase">
              Rastreo en Vivo
            </Text>
          </View>
          <Text className="text-slate-400 text-xs mt-0.5">
            {order.serviceType} • {order.status}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShareWhatsApp}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-md"
        >
          <Text className="text-white font-bold text-xs">📲 Compartir</Text>
        </TouchableOpacity>
      </View>

      {/* Mapa en Vivo */}
      <View className="flex-1 relative">
        <UniversalMap
          center={courierLocation || order.originPoint}
          origin={order.originPoint}
          destination={order.destinationPoint}
          courierLocation={courierLocation}
          zoom={14}
        />
      </View>

      {/* Tarjeta Inferior de Información */}
      <View className="bg-white rounded-t-3xl p-5 shadow-2xl">
        {order.courier ? (
          <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
                <Text className="text-2xl">
                  {order.courier.vehicleType === 'CAR' ? '🚗' : '🛵'}
                </Text>
              </View>
              <View>
                <Text className="text-base font-extrabold text-slate-900">
                  {order.courier.firstName} (Conductor)
                </Text>
                <Text className="text-xs text-slate-500 font-medium">
                  ⭐ {(Number(order.courier.ratingAvg) || 5.0).toFixed(1)} • {order.courier.vehicleType}{' '}
                  {order.courier.vehiclePlate ? `• Placa: ${order.courier.vehiclePlate}` : ''}
                </Text>
              </View>
            </View>

            <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-black text-emerald-700 uppercase">
                {isCompleted ? 'Entregado' : isCancelled ? 'Cancelado' : 'En Ruta'}
              </Text>
            </View>
          </View>
        ) : (
          <View className="py-2 mb-2 items-center">
            <Text className="text-xs text-slate-500 font-medium">Asignando conductor en la zona...</Text>
          </View>
        )}

        <View className="space-y-1">
          <Text className="text-xs text-slate-500" numberOfLines={1}>
            De: <Text className="font-semibold text-slate-800">{order.originAddress}</Text>
          </Text>
          <Text className="text-xs text-slate-500" numberOfLines={1}>
            A: <Text className="font-bold text-slate-900">{order.destinationAddress}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
