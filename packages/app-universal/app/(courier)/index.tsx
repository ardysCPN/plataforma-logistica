import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { UniversalMap } from '../../components/map/UniversalMap';
import { Button } from '../../components/common/Button';
import { PinModal } from '../../components/common/PinModal';
import { ChatModal } from '../../components/chat/ChatModal';
import { SosButton } from '../../components/common/SosButton';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { locationTracker } from '../../services/locationTracker';
import {
  ServiceOrder,
  SOCKET_EVENTS,
  SocketOrderNewAvailablePayload,
  SocketCorridorAlertPayload,
} from '@plataforma/shared';

export default function CourierHomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [availableOrders, setAvailableOrders] = useState<SocketOrderNewAvailablePayload[]>([]);
  const [corridorAlerts, setCorridorAlerts] = useState<SocketCorridorAlertPayload[]>([]);
  const [activeOrders, setActiveOrders] = useState<ServiceOrder[]>([]);

  // Modales
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedOrderIdForPin, setSelectedOrderIdForPin] = useState<string | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedOrderIdForChat, setSelectedOrderIdForChat] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    // Iniciar rastreo de ubicación en segundo plano
    locationTracker.requestPermissions().then((granted) => {
      if (granted) {
        locationTracker.startTracking(activeOrders.map((o) => o.id));
      }
    });

    const socket = getSocket();

    const handleNewOrder = (order: SocketOrderNewAvailablePayload) => {
      setAvailableOrders((prev) => [order, ...prev.filter((o) => o.orderId !== order.orderId)]);
    };

    const handleCorridorAlert = (alert: SocketCorridorAlertPayload) => {
      setCorridorAlerts((prev) => [alert, ...prev.filter((a) => a.orderId !== alert.orderId)]);
    };

    socket.on(SOCKET_EVENTS.ORDER_NEW_AVAILABLE, handleNewOrder);
    socket.on(SOCKET_EVENTS.ORDER_CORRIDOR_ALERT, handleCorridorAlert);

    return () => {
      socket.off(SOCKET_EVENTS.ORDER_NEW_AVAILABLE, handleNewOrder);
      socket.off(SOCKET_EVENTS.ORDER_CORRIDOR_ALERT, handleCorridorAlert);
      locationTracker.stopTracking();
    };
  }, [activeOrders]);

  // Tomar mandado atómicamente
  const handleClaimErrand = async (orderId: string) => {
    setLoadingAction(true);
    try {
      const res = await api.post(`/api/bids/claim-errand/${orderId}`);
      Alert.alert('¡Éxito!', res.data.message);
      setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      // Cargar orden en activas
      const orderRes = await api.get<ServiceOrder>(`/api/orders/${orderId}`);
      setActiveOrders((prev) => [orderRes.data, ...prev]);
    } catch (err: unknown) {
      Alert.alert('Aviso', err instanceof Error ? err.message : 'No se pudo adjudicar el mandado');
    } finally {
      setLoadingAction(false);
    }
  };

  // Enviar oferta o contraoferta
  const handleSubmitBid = async (orderId: string, offeredPrice: number) => {
    setLoadingAction(true);
    try {
      await api.post('/api/bids', {
        orderId,
        bidAmount: offeredPrice,
        etaMinutes: 10,
      });
      Alert.alert('Oferta enviada', 'El cliente está evaluando tu propuesta.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar la oferta');
    } finally {
      setLoadingAction(false);
    }
  };

  // Actualizar estado de orden
  const handleUpdateStatus = async (orderId: string, nextStatus: any) => {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status: nextStatus });
      setActiveOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error actualizando estado');
    }
  };

  // Verificar PIN OTP para finalizar
  const handleVerifyPin = async (pin: string) => {
    if (!selectedOrderIdForPin) return;
    const res = await api.post('/api/orders/complete-pin', {
      orderId: selectedOrderIdForPin,
      pin,
    });
    Alert.alert('¡Entrega Exitosa!', `Comisión debitada: $${res.data.commissionDeducted} COP`);
    setActiveOrders((prev) => prev.filter((o) => o.id !== selectedOrderIdForPin));
    setPinModalVisible(false);
    setSelectedOrderIdForPin(null);
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Barra Superior del Conductor */}
      <View className="bg-secondary px-5 py-4 pt-12 flex-row items-center justify-between shadow-md">
        <View>
          <Text className="text-white font-bold text-lg">{user?.fullName}</Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-400" />
            <Text className="text-xs text-slate-300">En línea • GPS 2do Plano Activo</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(courier)/wallet')}
          className="bg-primary/20 border border-primary/50 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5"
        >
          <Text className="text-primary font-bold text-xs">
            💰 ${user?.walletBalance || 0} COP
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alerta Destacada de Pedido en Corredor (Batching) */}
      {corridorAlerts.length > 0 && (
        <View className="bg-cyan-500 p-3.5 flex-row items-center justify-between shadow-sm">
          <View className="flex-1 mr-2">
            <Text className="text-white text-xs font-black uppercase tracking-wider">
              ¡Pedido en tu ruta activa!
            </Text>
            <Text className="text-white text-xs">
              +{corridorAlerts[0].extraEarnings} COP • Desvío menor a 400m
            </Text>
          </View>
          <Button
            title="Sumar Pedido"
            variant="secondary"
            onPress={() => handleClaimErrand(corridorAlerts[0].orderId)}
            className="py-1 px-3"
          />
        </View>
      )}

      {/* Contenido Principal */}
      <ScrollView className="flex-1 p-4">
        {/* Sección: Pedidos Activos en Curso */}
        {activeOrders.length > 0 && (
          <View className="mb-6">
            <Text className="text-base font-extrabold text-slate-900 mb-3">
              Entregas en Curso ({activeOrders.length}/3)
            </Text>
            {activeOrders.map((order) => (
              <View
                key={order.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 mb-3 shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-primary uppercase">
                    {order.serviceType}
                  </Text>
                  <Text className="text-base font-extrabold text-slate-900">
                    ${order.agreedPrice || order.offeredPrice} COP
                  </Text>
                </View>

                <Text className="text-sm font-semibold text-slate-800 mb-1">
                  📍 Entrega: {order.destinationAddress}
                </Text>
                {order.descriptionNotes ? (
                  <Text className="text-xs text-slate-500 mb-3">
                    Nota: {order.descriptionNotes}
                  </Text>
                ) : null}

                {/* Acciones de Estado */}
                <View className="flex-row gap-2 mt-2">
                  {order.status === 'ACCEPTED' && (
                    <Button
                      title="Llegué al Origen"
                      variant="outline"
                      onPress={() => handleUpdateStatus(order.id, 'ARRIVED_AT_ORIGIN')}
                      className="flex-1 py-2.5"
                    />
                  )}
                  {(order.status === 'ARRIVED_AT_ORIGIN' || order.status === 'PURCHASING') && (
                    <Button
                      title="Paquete Recogido"
                      variant="primary"
                      onPress={() => handleUpdateStatus(order.id, 'PICKED_UP')}
                      className="flex-1 py-2.5"
                    />
                  )}
                  {order.status === 'PICKED_UP' && (
                    <Button
                      title="En Tránsito"
                      variant="primary"
                      onPress={() => handleUpdateStatus(order.id, 'IN_TRANSIT')}
                      className="flex-1 py-2.5"
                    />
                  )}
                  {order.status === 'IN_TRANSIT' && (
                    <Button
                      title="Finalizar con PIN 🔐"
                      variant="primary"
                      onPress={() => {
                        setSelectedOrderIdForPin(order.id);
                        setPinModalVisible(true);
                      }}
                      className="flex-1 py-2.5"
                    />
                  )}

                  <Button
                    title="💬 Chat"
                    variant="secondary"
                    onPress={() => {
                      setSelectedOrderIdForChat(order.id);
                      setChatModalVisible(true);
                    }}
                    className="px-3.5 py-2.5"
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sección: Radar de Pedidos Disponibles */}
        <Text className="text-base font-extrabold text-slate-900 mb-3">
          Radar de Pedidos Cercanos
        </Text>

        {availableOrders.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-3xl p-8 items-center shadow-sm">
            <Text className="text-3xl mb-2">📡</Text>
            <Text className="text-sm font-bold text-slate-700 text-center mb-1">
              Escaneando la zona...
            </Text>
            <Text className="text-xs text-slate-400 text-center">
              Te avisaremos al instante con sonido cuando un cliente cercano solicite un servicio.
            </Text>
          </View>
        ) : (
          availableOrders.map((order) => (
            <View
              key={order.orderId}
              className="bg-white border border-slate-200 rounded-3xl p-5 mb-3 shadow-sm"
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-base">
                    {order.serviceType === 'DELIVERY' ? '📦' : order.serviceType === 'ERRAND' ? '🛒' : '🛵'}
                  </Text>
                  <Text className="text-xs font-bold text-slate-700 uppercase">
                    {order.serviceType}
                  </Text>
                </View>
                <Text className="text-lg font-black text-primary">
                  ${order.offeredPrice} COP
                </Text>
              </View>

              <Text className="text-xs text-slate-500 mb-1">
                De: {order.originAddress}
              </Text>
              <Text className="text-xs text-slate-800 font-semibold mb-3">
                A: {order.destinationAddress}
              </Text>

              {order.descriptionNotes ? (
                <Text className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl mb-3">
                  "{order.descriptionNotes}"
                </Text>
              ) : null}

              <View className="flex-row gap-2">
                {order.serviceType === 'ERRAND' ? (
                  <Button
                    title="Tomar Mandado (Directo)"
                    variant="primary"
                    onPress={() => handleClaimErrand(order.orderId)}
                    loading={loadingAction}
                    className="flex-1 py-2.5"
                  />
                ) : (
                  <>
                    <Button
                      title="Aceptar Tarifa"
                      variant="primary"
                      onPress={() => handleSubmitBid(order.orderId, order.offeredPrice)}
                      loading={loadingAction}
                      className="flex-1 py-2.5"
                    />
                    <Button
                      title="Contraofertar +$2k"
                      variant="outline"
                      onPress={() => handleSubmitBid(order.orderId, order.offeredPrice + 2000)}
                      loading={loadingAction}
                      className="flex-1 py-2.5"
                    />
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modales */}
      <PinModal
        visible={pinModalVisible}
        onVerify={handleVerifyPin}
        onCancel={() => {
          setPinModalVisible(false);
          setSelectedOrderIdForPin(null);
        }}
      />

      {selectedOrderIdForChat && (
        <ChatModal
          visible={chatModalVisible}
          orderId={selectedOrderIdForChat}
          currentUserId={user?.id || ''}
          counterpartName="Cliente"
          onClose={() => {
            setChatModalVisible(false);
            setSelectedOrderIdForChat(null);
          }}
        />
      )}
    </View>
  );
}
