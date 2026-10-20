import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { UniversalMap, NearbyCourierMarker } from '../../components/map/UniversalMap';
import { Input } from '../../components/common/Input';
import { AddressAutocomplete } from '../../components/common/AddressAutocomplete';
import { Button } from '../../components/common/Button';
import { ChatModal } from '../../components/chat/ChatModal';
import { ChatsModal } from '../../components/chat/ChatsModal';
import { SosButton } from '../../components/common/SosButton';
import { RatingModal } from '../../components/common/RatingModal';
import { HistoryModal } from '../../components/common/HistoryModal';
import { PqrModal } from '../../components/common/PqrModal';
import { AppDrawer } from '../../components/common/AppDrawer';
import { NotificationBanner, BannerNotification } from '../../components/common/NotificationBanner';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { locationTracker } from '../../services/locationTracker';
import {
  ServiceType,
  ServiceOrder,
  GeoPoint,
  SOCKET_EVENTS,
  SocketBidReceivedPayload,
  SocketOrderAssignedPayload,
  SocketOrderStatusChangePayload,
} from '@plataforma/shared';

interface StopItem {
  id: string;
  address: string;
  point: GeoPoint;
}

export default function ClientHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  // Ubicación del usuario (GPS)
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(() => locationTracker.getCachedLocation());
  const [locatingGps, setLocatingGps] = useState(false);

  // Estados de solicitud
  const [serviceType, setServiceType] = useState<ServiceType>('DELIVERY');
  const [originAddress, setOriginAddress] = useState('Mi ubicación actual');
  const [originPoint, setOriginPoint] = useState<GeoPoint>(() => locationTracker.getCachedLocation() || { latitude: 6.2442, longitude: -75.5812 });
  const [intermediateStops, setIntermediateStops] = useState<StopItem[]>([]);
  const [destAddress, setDestAddress] = useState('Parque Central');
  const [destPoint, setDestPoint] = useState<GeoPoint>({ latitude: 6.2085, longitude: -75.5678 });
  const [description, setDescription] = useState('');
  const [estimatedPurchase, setEstimatedPurchase] = useState('25000');
  const [offeredPrice, setOfferedPrice] = useState('10000');

  // Estado de orden activa
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  const [incomingBids, setIncomingBids] = useState<SocketBidReceivedPayload[]>([]);
  const [courierLocation, setCourierLocation] = useState<{ latitude: number; longitude: number; bearing?: number } | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [assignedCourier, setAssignedCourier] = useState<any>(null);

  // Conductores cercanos en mapa (Estilo Uber / InDrive)
  const [nearbyCouriers, setNearbyCouriers] = useState<NearbyCourierMarker[]>([]);

  // Modales y Notificaciones
  const [chatVisible, setChatVisible] = useState(false);
  const [chatsModalVisible, setChatsModalVisible] = useState(false);
  const [selectedChatOrderId, setSelectedChatOrderId] = useState<string | null>(null);
  const [selectedChatCounterpart, setSelectedChatCounterpart] = useState('Conductor');
  const [ratingVisible, setRatingVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pqrModalVisible, setPqrModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeNotification, setActiveNotification] = useState<BannerNotification | null>(null);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Función explícita para capturar GPS del cliente
  const handleCaptureGps = async () => {
    setLocatingGps(true);
    try {
      const granted = await locationTracker.requestPermissions();
      if (granted) {
        const loc = await locationTracker.getCurrentLocation();
        if (loc) {
          setUserLocation(loc);
          setOriginPoint(loc);
          setOriginAddress(`Mi ubicación actual (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`);
          fetchNearbyCouriers(loc.latitude, loc.longitude);
        }
      } else {
        const msg = 'Por favor habilita el permiso de ubicación en tu navegador para ubicarte con exactitud.';
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Permiso Requerido', msg);
      }
    } catch (err) {
      console.warn('Error capturando GPS:', err);
    } finally {
      setLocatingGps(false);
    }
  };

  // 1. Inicialización de GPS
  useEffect(() => {
    let isMounted = true;

    // Si ya hay ubicación en caché, iniciar allí de una vez
    const cached = locationTracker.getCachedLocation();
    if (cached) {
      setOriginPoint(cached);
      setUserLocation(cached);
      setOriginAddress(`Mi ubicación actual (${cached.latitude.toFixed(4)}, ${cached.longitude.toFixed(4)})`);
      fetchNearbyCouriers(cached.latitude, cached.longitude);
    }

    // Solicitar permiso en segundo plano
    locationTracker.requestPermissions().then(async (granted) => {
      if (granted && isMounted) {
        const loc = await locationTracker.getCurrentLocation();
        if (loc && isMounted) {
          setUserLocation(loc);
          setOriginPoint(loc);
          setOriginAddress(`Mi ubicación actual (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`);
          fetchNearbyCouriers(loc.latitude, loc.longitude);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Consulta y Simulación de Conductores Cercanos
  const fetchNearbyCouriers = async (lat: number, lng: number) => {
    try {
      const res = await api.get<any[]>('/api/orders/nearby-couriers', {
        params: { lat, lng, radius: 10000 },
      });

      let couriers: NearbyCourierMarker[] = res.data.map((c) => ({
        id: c.id,
        latitude: c.latitude,
        longitude: c.longitude,
        vehicleType: c.vehicleType || 'MOTO',
        bearing: c.bearing || 0,
        name: c.fullName,
      }));

      if (couriers.length < 3) {
        const simulatedOffsets = [
          { dLat: 0.0035, dLng: 0.0028, type: 'MOTO', angle: 45 },
          { dLat: -0.0028, dLng: 0.0042, type: 'CAR', angle: 120 },
          { dLat: 0.0041, dLng: -0.0031, type: 'MOTO', angle: 210 },
          { dLat: -0.0032, dLng: -0.0025, type: 'MOTO', angle: 315 },
        ];

        const simulated = simulatedOffsets.map((s, idx) => ({
          id: `sim_${idx + 1}`,
          latitude: lat + s.dLat,
          longitude: lng + s.dLng,
          vehicleType: s.type,
          bearing: s.angle,
          name: `Conductor Cercano #${idx + 1}`,
        }));

        couriers = [...couriers, ...simulated];
      }

      setNearbyCouriers(couriers);
    } catch {
      // Fallback
    }
  };

  // Movimiento sutil de vehículos
  useEffect(() => {
    const interval = setInterval(() => {
      setNearbyCouriers((prev) =>
        prev.map((c) => {
          if (c.id.startsWith('sim_')) {
            const deltaLat = (Math.random() - 0.5) * 0.0004;
            const deltaLng = (Math.random() - 0.5) * 0.0004;
            return {
              ...c,
              latitude: c.latitude + deltaLat,
              longitude: c.longitude + deltaLng,
              bearing: Math.floor(Math.random() * 360),
            };
          }
          return c;
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // 3. Sockets y Eventos en Vivo
  useEffect(() => {
    const socket = getSocket();

    const handleBidReceived = (bid: SocketBidReceivedPayload) => {
      setIncomingBids((prev) => [bid, ...prev.filter((b) => b.courierId !== bid.courierId)]);
      setActiveNotification({
        id: `bid_${Date.now()}`,
        type: 'BID',
        title: '💰 ¡Nueva Oferta de Conductor!',
        message: `${bid.courierName} ofrece $${bid.bidAmount?.toLocaleString()} COP (⭐ ${bid.courierRating?.toFixed(1) || '5.0'})`,
      });
    };

    const handleAssigned = (payload: SocketOrderAssignedPayload) => {
      setAssignedCourier(payload.courier);
      setActiveOrder((prev) => (prev ? {
        ...prev,
        status: 'ACCEPTED',
        agreedPrice: payload.agreedPrice,
        courierId: payload.courier.id,
      } : null));
      setIncomingBids([]);

      setActiveNotification({
        id: `assigned_${Date.now()}`,
        type: 'STATUS',
        title: '🎉 ¡Conductor Confirmado!',
        message: `${payload.courier.fullName} se dirige al punto de recogida en su ${payload.courier.vehicleType} ${payload.courier.vehiclePlate || ''}.`,
      });
    };

    const handleStatusChange = (data: SocketOrderStatusChangePayload) => {
      if (activeOrder && activeOrder.id === data.orderId) {
        setActiveOrder((prev) => (prev ? { ...prev, status: data.newStatus } : null));

        let statusText = 'El estado de tu viaje ha cambiado.';
        if (data.newStatus === 'ARRIVED_AT_ORIGIN') statusText = '📍 ¡El conductor ha llegado al punto de recogida!';
        else if (data.newStatus === 'PICKED_UP') statusText = '📦 Tu paquete o pedido ha sido recogido por el conductor.';
        else if (data.newStatus === 'IN_TRANSIT') statusText = '🚀 El conductor va en camino hacia la entrega final.';

        setActiveNotification({
          id: `status_${Date.now()}`,
          type: 'STATUS',
          title: '🛵 Actualización del Viaje',
          message: statusText,
        });
      }
    };

    const handleChatReceive = (msg: any) => {
      if (msg.senderId !== user?.id) {
        setUnreadChatsCount((prev) => prev + 1);
        if (!chatVisible) {
          setActiveNotification({
            id: `chat_${Date.now()}`,
            type: 'CHAT',
            title: `💬 Mensaje de ${msg.senderName || 'Conductor'}`,
            message: msg.content,
            onPress: () => setChatVisible(true),
          });
        }
      }
    };

    const handleLocationFeed = (feed: { orderId: string; latitude: number; longitude: number; bearing?: number }) => {
      if (activeOrder && feed.orderId === activeOrder.id) {
        setCourierLocation({ latitude: feed.latitude, longitude: feed.longitude, bearing: feed.bearing });
      }
    };

    const handleCompleted = () => {
      if (activeOrder) {
        setCompletedOrderId(activeOrder.id);
      }
      setRatingVisible(true);
      setActiveOrder(null);
      setCourierLocation(null);
      setAssignedCourier(null);
      setActiveNotification({
        id: `completed_${Date.now()}`,
        type: 'STATUS',
        title: '🏁 ¡Servicio Completado!',
        message: 'Tu pedido ha llegado a su destino. ¡Gracias por usar la plataforma!',
      });
    };

    const handleCancelled = (payload: { orderId: string }) => {
      if (activeOrder && activeOrder.id === payload.orderId) {
        if (Platform.OS === 'web') alert('La orden fue cancelada.');
        else Alert.alert('Aviso', 'La orden fue cancelada.');
        setActiveOrder(null);
        setIncomingBids([]);
        setCourierLocation(null);
        setAssignedCourier(null);
      }
    };

    socket.on(SOCKET_EVENTS.BID_RECEIVED, handleBidReceived);
    socket.on(SOCKET_EVENTS.ORDER_ASSIGNED, handleAssigned);
    socket.on(SOCKET_EVENTS.ORDER_STATUS_CHANGE, handleStatusChange);
    socket.on(SOCKET_EVENTS.CHAT_RECEIVE, handleChatReceive);
    socket.on(SOCKET_EVENTS.LOCATION_CLIENT_FEED, handleLocationFeed);
    socket.on(SOCKET_EVENTS.ORDER_COMPLETED, handleCompleted);
    socket.on(SOCKET_EVENTS.ORDER_CANCELLED, handleCancelled);

    return () => {
      socket.off(SOCKET_EVENTS.BID_RECEIVED, handleBidReceived);
      socket.off(SOCKET_EVENTS.ORDER_ASSIGNED, handleAssigned);
      socket.off(SOCKET_EVENTS.ORDER_STATUS_CHANGE, handleStatusChange);
      socket.off(SOCKET_EVENTS.CHAT_RECEIVE, handleChatReceive);
      socket.off(SOCKET_EVENTS.LOCATION_CLIENT_FEED, handleLocationFeed);
      socket.off(SOCKET_EVENTS.ORDER_COMPLETED, handleCompleted);
      socket.off(SOCKET_EVENTS.ORDER_CANCELLED, handleCancelled);
    };
  }, [activeOrder]);

  // 4. Crear Orden
  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      // Si hay paradas intermedias, anexarlas en descripción/notas
      let finalDescription = description;
      if (intermediateStops.length > 0) {
        const stopsSummary = intermediateStops.map((s, i) => `[Parada ${i + 1}: ${s.address}]`).join(' -> ');
        finalDescription = finalDescription ? `${finalDescription} • Paradas: ${stopsSummary}` : `Paradas intermedias: ${stopsSummary}`;
      }

      const res = await api.post<ServiceOrder>('/api/orders', {
        serviceType,
        originAddress,
        originPoint,
        destinationAddress: destAddress,
        destinationPoint: destPoint,
        descriptionNotes: finalDescription || undefined,
        estimatedPurchaseCost: serviceType === 'ERRAND' ? Number(estimatedPurchase) : 0,
        offeredPrice: Number(offeredPrice),
      });

      setActiveOrder(res.data);
      setIncomingBids([]);

      const socket = getSocket();
      socket.emit('order:join', res.data.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear el pedido';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // 5. Cancelar Orden
  const handleCancelOrder = async () => {
    if (!activeOrder) return;

    const executeCancel = async () => {
      setCancelling(true);
      try {
        await api.post(`/api/orders/${activeOrder.id}/cancel`);
        if (Platform.OS === 'web') alert('Tu solicitud ha sido cancelada exitosamente.');
        else Alert.alert('Pedido Cancelado', 'Tu solicitud ha sido cancelada exitosamente.');
        setActiveOrder(null);
        setIncomingBids([]);
        setCourierLocation(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No se pudo cancelar el pedido';
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Error', msg);
      } finally {
        setCancelling(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que deseas cancelar este pedido?')) {
        await executeCancel();
      }
    } else {
      Alert.alert(
        'Confirmar Cancelación',
        '¿Deseas cancelar esta solicitud de servicio?',
        [
          { text: 'No, continuar', style: 'cancel' },
          { text: 'Sí, Cancelar', style: 'destructive', onPress: executeCancel },
        ]
      );
    }
  };

  // 6. Aceptar Oferta de Conductor
  const handleAcceptBid = async (bidId: string) => {
    if (!activeOrder) return;
    try {
      await api.post('/api/bids/accept', {
        orderId: activeOrder.id,
        bidId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo aceptar la oferta';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  // 7. Calificar Conductor
  const handleRateSubmit = async (score: number, tags: string[], comment?: string) => {
    if (!completedOrderId) return;
    try {
      await api.post(`/api/orders/${completedOrderId}/rate`, {
        score,
        comment,
        feedbackTags: tags,
      });
      if (Platform.OS === 'web') alert('¡Gracias! Tu calificación ayuda a mantener segura la plataforma.');
      else Alert.alert('¡Gracias!', 'Tu calificación ayuda a mantener segura la plataforma.');
    } catch (err) {
      console.warn('Error calificando servicio:', err);
    }
  };

  // 8. Compartir viaje con familiares vía WhatsApp (Live Trip Sharing)
  const handleShareLiveTrip = () => {
    if (!activeOrder) return;
    const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
    const trackUrl = `${origin}/track/${activeOrder.id}`;
    const text = encodeURIComponent(`Hola, sigo en camino con mi servicio. Puedes ver mi ubicación y recorrido en vivo en el mapa aquí: ${trackUrl}`);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${text}`;

    if (Platform.OS === 'web') {
      window.open(whatsappUrl, '_blank');
    } else {
      Linking.openURL(whatsappUrl).catch(() => {});
    }
  };

  // 9. Cerrar Sesión
  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Notificación Flotante Superior (Estilo Push / Celular) */}
      <NotificationBanner
        notification={activeNotification}
        onDismiss={() => setActiveNotification(null)}
      />

      {/* Barra de Encabezado Superior Móvil Limpia con Menú Hamburguesa */}
      <View className="bg-secondary px-4 py-3 pt-12 flex-row items-center justify-between shadow-md z-20">
        <View className="flex-row items-center gap-3">
          {/* Botón Hamburguesa ☰ con indicador de no leídos */}
          <TouchableOpacity
            onPress={() => setDrawerVisible(true)}
            className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 items-center justify-center active:bg-white/20 relative"
          >
            <Text className="text-white text-lg font-bold">☰</Text>
            {unreadChatsCount > 0 && (
              <View className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-secondary" />
            )}
          </TouchableOpacity>

          <View>
            <Text className="text-white font-black text-base tracking-tight">
              ⚡ DOMY
            </Text>
            <Text className="text-[11px] text-slate-300">
              Hola, {user?.fullName?.split(' ')[0] || 'Cliente'} 👋
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Botón de Captura de GPS */}
          <TouchableOpacity
            onPress={handleCaptureGps}
            disabled={locatingGps}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-sm"
          >
            {locatingGps ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-xs font-bold text-white">🎯 Mi Ubicación</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Mitad Superior: Mapa Universal Interactivo */}
      <View className="h-[42%] w-full relative">
        <UniversalMap
          center={originPoint}
          origin={originPoint}
          destination={destPoint}
          intermediateStops={intermediateStops.map((s) => s.point)}
          courierLocation={courierLocation}
          userLocation={userLocation}
          nearbyCouriers={nearbyCouriers}
          darkMode={darkMode}
          onMapClick={(point) => {
            if (!activeOrder) {
              setDestPoint(point);
              setDestAddress(`Punto seleccionado (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`);
            }
          }}
        />

        {activeOrder && (
          <View className="absolute top-4 right-4 z-10">
            <SosButton orderId={activeOrder.id} />
          </View>
        )}
      </View>

      {/* Mitad Inferior: Panel Interactivo */}
      <ScrollView className="flex-1 p-5">
        {activeOrder ? (
          // Vista de Orden Activa
          <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {activeOrder.status === 'SEARCHING' ? 'Buscando conductores...' : 'En curso'}
                </Text>
              </View>
              <Text className="text-primary font-black text-lg">
                ${activeOrder.agreedPrice || activeOrder.offeredPrice} COP
              </Text>
            </View>

            {/* PIN de Seguridad OTP */}
            {activeOrder.deliveryPin && (
              <View className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 my-3 items-center">
                <Text className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1">
                  Tu PIN Secreto de Entrega
                </Text>
                <Text className="text-4xl font-extrabold text-amber-950 tracking-[10px]">
                  {activeOrder.deliveryPin}
                </Text>
                <Text className="text-[11px] text-amber-700 mt-1.5 text-center">
                  Díctaselo al conductor únicamente cuando tengas tu paquete o servicio en mano.
                </Text>
              </View>
            )}

            {/* Subasta en Vivo: Ofertas Recibidas */}
            {activeOrder.status === 'SEARCHING' && (
              <View className="mt-3">
                <Text className="text-sm font-bold text-slate-900 mb-2">
                  Contraofertas Recibidas ({incomingBids.length})
                </Text>
                {incomingBids.length === 0 ? (
                  <View className="py-4 items-center">
                    <Text className="text-xs text-slate-400 text-center">
                      Transmitiendo tu pedido a conductores en la zona...
                    </Text>
                  </View>
                ) : (
                  incomingBids.map((bid) => (
                    <View
                      key={bid.bidId}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-sm font-bold text-slate-900">{bid.courierName}</Text>
                        <Text className="text-xs text-slate-500">
                          ⭐ {bid.courierRating?.toFixed(1) || '5.0'} • {bid.vehicleType} {bid.vehiclePlate || ''}
                        </Text>
                        {bid.etaMinutes && (
                          <Text className="text-xs text-emerald-600 font-semibold mt-0.5">
                            Llega en ~{bid.etaMinutes} mins
                          </Text>
                        )}
                      </View>
                      <View className="items-end gap-1.5">
                        <Text className="text-base font-black text-slate-900">
                          ${bid.bidAmount?.toLocaleString()} COP
                        </Text>
                        <Button
                          title="Aceptar"
                          variant="primary"
                          onPress={() => handleAcceptBid(bid.bidId)}
                          className="py-1 px-3.5"
                        />
                      </View>
                    </View>
                  ))
                )}

                {/* BOTÓN CANCELAR ORDEN */}
                <Button
                  title={cancelling ? 'Cancelando...' : '❌ Cancelar Solicitud'}
                  variant="outline"
                  onPress={handleCancelOrder}
                  loading={cancelling}
                  className="mt-4 border-rose-300 text-rose-600"
                />
              </View>
            )}

            {/* Tarjeta de Conductor Asignado y Progreso en Tiempo Real */}
            {activeOrder.status !== 'SEARCHING' && (
              <View className="mt-3">
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-3">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-12 h-12 rounded-full bg-secondary items-center justify-center">
                        <Text className="text-xl">🛵</Text>
                      </View>
                      <View>
                        <Text className="text-sm font-extrabold text-slate-900">
                          {assignedCourier?.fullName || 'Conductor Asignado'}
                        </Text>
                        <Text className="text-xs text-slate-500">
                          {assignedCourier?.vehicleType || 'MOTO'} • Placa: <Text className="font-bold text-slate-800">{assignedCourier?.vehiclePlate || 'N/A'}</Text>
                        </Text>
                        <Text className="text-xs text-amber-500 font-bold mt-0.5">
                          ⭐ {assignedCourier?.ratingAvg?.toFixed(1) || '5.0'} Conductor Verificado
                        </Text>
                      </View>
                    </View>

                    {assignedCourier?.phone ? (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${assignedCourier.phone}`).catch(() => {})}
                        className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center border border-emerald-300 active:bg-emerald-200"
                      >
                        <Text className="text-lg">📞</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Pasos de Progreso Visual */}
                  <View className="pt-2 border-t border-slate-200">
                    <Text className="text-xs font-bold text-slate-700 mb-2">Estado del Servicio:</Text>
                    <View className="flex-row items-center justify-between">
                      <View className="items-center flex-1">
                        <View className={`w-6 h-6 rounded-full items-center justify-center ${activeOrder.status === 'ACCEPTED' || activeOrder.status === 'ARRIVED_AT_ORIGIN' || activeOrder.status === 'PICKED_UP' || activeOrder.status === 'IN_TRANSIT' ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          <Text className="text-white text-[10px] font-bold">✓</Text>
                        </View>
                        <Text className="text-[10px] text-center font-bold text-slate-700 mt-1">Asignado</Text>
                      </View>

                      <View className={`h-1 flex-1 ${activeOrder.status === 'ARRIVED_AT_ORIGIN' || activeOrder.status === 'PICKED_UP' || activeOrder.status === 'IN_TRANSIT' ? 'bg-emerald-500' : 'bg-slate-200'}`} />

                      <View className="items-center flex-1">
                        <View className={`w-6 h-6 rounded-full items-center justify-center ${activeOrder.status === 'ARRIVED_AT_ORIGIN' || activeOrder.status === 'PICKED_UP' || activeOrder.status === 'IN_TRANSIT' ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          <Text className="text-white text-[10px] font-bold">2</Text>
                        </View>
                        <Text className="text-[10px] text-center font-bold text-slate-700 mt-1">En Origen</Text>
                      </View>

                      <View className={`h-1 flex-1 ${activeOrder.status === 'PICKED_UP' || activeOrder.status === 'IN_TRANSIT' ? 'bg-emerald-500' : 'bg-slate-200'}`} />

                      <View className="items-center flex-1">
                        <View className={`w-6 h-6 rounded-full items-center justify-center ${activeOrder.status === 'PICKED_UP' || activeOrder.status === 'IN_TRANSIT' ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          <Text className="text-white text-[10px] font-bold">3</Text>
                        </View>
                        <Text className="text-[10px] text-center font-bold text-slate-700 mt-1">En Ruta</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View className="gap-2">
                  <Button
                    title="💬 Abrir Chat con el Conductor"
                    variant="primary"
                    onPress={() => {
                      setSelectedChatOrderId(activeOrder.id);
                      setSelectedChatCounterpart(assignedCourier?.fullName || 'Conductor');
                      setChatVisible(true);
                    }}
                  />
                  <Button
                    title="📲 Compartir Viaje en Vivo (WhatsApp)"
                    variant="outline"
                    onPress={handleShareLiveTrip}
                    className="border-emerald-300 bg-emerald-50 text-emerald-800"
                  />
                  <Button
                    title="❌ Cancelar Servicio"
                    variant="outline"
                    onPress={handleCancelOrder}
                    loading={cancelling}
                    className="border-rose-300 text-rose-600"
                  />
                </View>
              </View>
            )}
          </View>
        ) : (
          // Formulario de Solicitud de Servicio
          <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-extrabold text-slate-900">
                ¿Qué necesitas hoy?
              </Text>
              <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Text className="text-[11px] font-bold text-emerald-700">
                  {nearbyCouriers.length} conductores cerca
                </Text>
              </View>
            </View>

            {/* Selector de Servicio */}
            <View className="flex-row gap-2 mb-5">
              {(
                [
                  { type: 'DELIVERY', label: 'Domicilio', icon: '📦' },
                  { type: 'ERRAND', label: 'Mandado', icon: '🛒' },
                  { type: 'TRANSPORT', label: 'Transporte', icon: '🛵' },
                ] as const
              ).map((s) => (
                <TouchableOpacity
                  key={s.type}
                  onPress={() => setServiceType(s.type)}
                  className={`flex-1 p-3 rounded-2xl border items-center ${
                    serviceType === s.type
                      ? 'border-primary bg-primary/10'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Text className="text-2xl mb-1">{s.icon}</Text>
                  <Text
                    className={`text-xs font-bold ${
                      serviceType === s.type ? 'text-primary' : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Punto de Recogida con Autocompletado Nominatim y botón GPS */}
            <AddressAutocomplete
              label="Punto de Recogida / Salida"
              value={originAddress}
              onChangeText={setOriginAddress}
              onSelectLocation={(point, text) => {
                setOriginPoint(point);
                setOriginAddress(text);
              }}
              nearLocation={originPoint}
              rightAction={
                <TouchableOpacity
                  onPress={handleCaptureGps}
                  disabled={locatingGps}
                  className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-row items-center gap-1 active:bg-emerald-100"
                >
                  {locatingGps ? (
                    <ActivityIndicator size="small" color="#059669" />
                  ) : (
                    <Text className="text-[10px] font-bold text-emerald-700">🎯 Mi Ubicación (GPS)</Text>
                  )}
                </TouchableOpacity>
              }
            />

            {/* Paradas Intermedias (Multi-Drop) */}
            {intermediateStops.map((stop, idx) => (
              <View key={stop.id} className="relative">
                <AddressAutocomplete
                  label={`Parada Intermedia ${idx + 1}`}
                  value={stop.address}
                  onChangeText={(t) => {
                    setIntermediateStops((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, address: t } : s))
                    );
                  }}
                  onSelectLocation={(point, text) => {
                    setIntermediateStops((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, address: text, point } : s))
                    );
                  }}
                  placeholder="Dirección de la parada intermedia..."
                  nearLocation={originPoint}
                  rightAction={
                    <TouchableOpacity
                      onPress={() => setIntermediateStops((prev) => prev.filter((_, i) => i !== idx))}
                      className="bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"
                    >
                      <Text className="text-[10px] font-bold text-red-600">✕ Quitar</Text>
                    </TouchableOpacity>
                  }
                />
              </View>
            ))}

            {/* Botón para añadir parada intermedia */}
            {intermediateStops.length < 2 && (
              <TouchableOpacity
                onPress={() => {
                  setIntermediateStops((prev) => [
                    ...prev,
                    {
                      id: String(Date.now()),
                      address: '',
                      point: { latitude: originPoint.latitude + 0.004, longitude: originPoint.longitude + 0.004 },
                    },
                  ]);
                }}
                className="mb-3 py-1.5 px-3 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-slate-200"
              >
                <Text className="text-xs font-bold text-slate-700">➕ Agregar Parada Intermedia (Multi-Destino)</Text>
              </TouchableOpacity>
            )}

            {/* Punto de Destino Final con Autocompletado */}
            <AddressAutocomplete
              label="Punto de Entrega / Destino Final"
              value={destAddress}
              onChangeText={setDestAddress}
              onSelectLocation={(point, text) => {
                setDestPoint(point);
                setDestAddress(text);
              }}
              placeholder="Escribe calle, barrio o toca en el mapa..."
              nearLocation={originPoint}
            />

            {serviceType === 'ERRAND' ? (
              <>
                <Input
                  label="Lista de Compras o Encargo"
                  placeholder="Ej. Leche, pan y medicina en la farmacia"
                  value={description}
                  onChangeText={setDescription}
                />
                <Input
                  label="Monto Estimado de los Productos ($ COP)"
                  keyboardType="numeric"
                  value={estimatedPurchase}
                  onChangeText={setEstimatedPurchase}
                />
              </>
            ) : (
              <Input
                label="Instrucciones o Referencia"
                placeholder="Ej. Recoger paquete en portería"
                value={description}
                onChangeText={setDescription}
              />
            )}

            <Input
              label="Tu Oferta de Tarifa ($ COP) *"
              keyboardType="numeric"
              value={offeredPrice}
              onChangeText={setOfferedPrice}
            />

            <Button
              title="Publicar Solicitud"
              variant="primary"
              onPress={handleCreateOrder}
              loading={loading}
              className="mt-2"
            />
          </View>
        )}
      </ScrollView>

      {/* Modales Auxiliares */}
      {chatVisible && (selectedChatOrderId || activeOrder?.id) && (
        <ChatModal
          visible={chatVisible}
          orderId={selectedChatOrderId || activeOrder?.id || ''}
          currentUserId={user?.id || ''}
          counterpartName={selectedChatCounterpart || 'Conductor Asignado'}
          onClose={() => {
            setChatVisible(false);
            setSelectedChatOrderId(null);
          }}
        />
      )}

      {/* Bandeja de Todos los Chats (Activos y Pasados) */}
      <ChatsModal
        visible={chatsModalVisible}
        onClose={() => setChatsModalVisible(false)}
        onSelectChat={(orderId, counterpart) => {
          setSelectedChatOrderId(orderId);
          setSelectedChatCounterpart(counterpart);
          setChatVisible(true);
        }}
      />

      {/* Menú Lateral Hamburguesa Móvil */}
      <AppDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={user}
        isCourier={false}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenChats={() => setChatsModalVisible(true)}
        onOpenHistory={() => setHistoryVisible(true)}
        onOpenPqr={() => setPqrModalVisible(true)}
        onLogout={handleLogout}
        unreadChatsCount={unreadChatsCount}
      />

      <RatingModal
        visible={ratingVisible}
        targetName="tu conductor"
        onSubmit={handleRateSubmit}
        onClose={() => setRatingVisible(false)}
      />

      <HistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        isCourier={false}
      />

      <PqrModal
        visible={pqrModalVisible}
        orderId={activeOrder?.id || ''}
        isCourier={false}
        onClose={() => setPqrModalVisible(false)}
      />
    </View>
  );
}
