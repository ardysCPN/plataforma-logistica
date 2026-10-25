import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { UniversalMap, NearbyCourierMarker } from '../../components/map/UniversalMap';
import { Input } from '../../components/common/Input';
import { AddressAutocomplete } from '../../components/common/AddressAutocomplete';
import { Button } from '../../components/common/Button';
import { UniversalDialog } from '../../components/common/UniversalDialog';
import { ChatModal } from '../../components/chat/ChatModal';
import { ChatsModal } from '../../components/chat/ChatsModal';
import { SosButton } from '../../components/common/SosButton';
import { RatingModal } from '../../components/common/RatingModal';
import { HistoryModal } from '../../components/common/HistoryModal';
import { PqrModal } from '../../components/common/PqrModal';
import { AppDrawer } from '../../components/common/AppDrawer';
import { ProfileModal } from '../../components/common/ProfileModal';
import { CourierDetailModal, CourierDetailInfo } from '../../components/common/CourierDetailModal';
import { NotificationBanner, BannerNotification } from '../../components/common/NotificationBanner';
import { ConfirmationDialog } from '../../components/common/ConfirmationDialog';
import { UpdatePromptModal } from '../../components/common/UpdatePromptModal';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { locationTracker } from '../../services/locationTracker';
import { soundNotification } from '../../services/soundNotification';
import { notificationService } from '../../services/notificationService';
import { routeDeviationService } from '../../services/routeDeviationService';
import { geocodingService } from '../../services/geocodingService';
import { versionService, VersionCheckResult } from '../../services/versionService';
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
  const [destAddress, setDestAddress] = useState('');
  const [destPoint, setDestPoint] = useState<GeoPoint | null>(null);
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
  const [ratingTargetName, setRatingTargetName] = useState('tu conductor');
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [updatePromptVisible, setUpdatePromptVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pqrModalVisible, setPqrModalVisible] = useState(false);
  const [selectedPqrOrderId, setSelectedPqrOrderId] = useState<string>('');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [courierDetailVisible, setCourierDetailVisible] = useState(false);
  const [selectedCourierDetail, setSelectedCourierDetail] = useState<CourierDetailInfo | null>(null);
  const [selectedBidPrice, setSelectedBidPrice] = useState<number | undefined>(undefined);
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeNotification, setActiveNotification] = useState<BannerNotification | null>(null);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => soundNotification.isSoundEnabled());
  const [isCurtainCollapsed, setIsCurtainCollapsed] = useState(false);
  const [activeRouteCoords, setActiveRouteCoords] = useState<[number, number][]>([]);
  const [deviationAlert, setDeviationAlert] = useState<{
    visible: boolean;
    distanceMeters: number;
  }>({ visible: false, distanceMeters: 0 });

  const lastChatMsgIdRef = useRef<string | null>(null);
  const activeOrderRef = useRef<ServiceOrder | null>(activeOrder);
  const activeRouteCoordsRef = useRef<[number, number][]>([]);
  const consecutiveDeviationsRef = useRef<number>(0);

  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  useEffect(() => {
    activeRouteCoordsRef.current = activeRouteCoords;
  }, [activeRouteCoords]);

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

  // Verificación de versión actualizada en el inicio
  useEffect(() => {
    if (versionService.isDismissedForSession()) return;
    versionService
      .checkVersion()
      .then((res) => {
        if (res && res.isOutdated && (!versionService.isDismissedForSession() || res.isMandatory)) {
          setVersionInfo(res);
          setUpdatePromptVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  // Restaurar viaje activo si el cliente recarga la página o reingresa a la app
  useEffect(() => {
    let isMounted = true;
    api.get<any>('/api/orders/my-active')
      .then((res) => {
        if (!isMounted || !res.data?.order) return;
        const o = res.data.order;
        setActiveOrder(o);
        if (res.data.courier) setAssignedCourier(res.data.courier);
        if (res.data.bids) setIncomingBids(res.data.bids);
        if (o.originPoint) {
          setOriginPoint(o.originPoint);
          if (o.originAddress) setOriginAddress(o.originAddress);
        }
        if (o.destinationPoint) {
          setDestPoint(o.destinationPoint);
          if (o.destinationAddress) setDestAddress(o.destinationAddress);
        }
        const socket = getSocket();
        socket.emit('order:join', o.id);
      })
      .catch((err) => console.warn('No hay orden activa para restaurar:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectActiveOrderFromHistory = async (orderId: string) => {
    try {
      setLoading(true);
      const res = await api.get<any>('/api/orders/my-active');
      if (res.data?.order && res.data.order.id === orderId) {
        const o = res.data.order;
        setActiveOrder(o);
        if (res.data.courier) setAssignedCourier(res.data.courier);
        if (res.data.bids) setIncomingBids(res.data.bids);
        if (o.originPoint) setOriginPoint(o.originPoint);
        if (o.destinationPoint) setDestPoint(o.destinationPoint);
        const socket = getSocket();
        socket.emit('order:join', o.id);
      } else {
        const directRes = await api.get<ServiceOrder>(`/api/orders/${orderId}`);
        if (directRes.data) {
          setActiveOrder(directRes.data);
          if (directRes.data.originPoint) setOriginPoint(directRes.data.originPoint);
          if (directRes.data.destinationPoint) setDestPoint(directRes.data.destinationPoint);
          const socket = getSocket();
          socket.emit('order:join', directRes.data.id);
        }
      }
    } catch (err) {
      console.warn('Error al restaurar orden desde historial:', err);
    } finally {
      setLoading(false);
    }
  };

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
      setIncomingBids((prev) => {
        const next = [bid, ...prev.filter((b) => b.courierId !== bid.courierId)];
        const count = next.length;
        const title = count > 1 ? `💰 ¡Tienes ${count} ofertas de conductores!` : '💰 ¡Nueva Oferta de Conductor!';
        const message = count > 1
          ? `Última: ${bid.courierName} ofrece $${Number(bid.bidAmount || 0).toLocaleString()} COP`
          : `${bid.courierName} ofrece $${Number(bid.bidAmount || 0).toLocaleString()} COP (⭐ ${(Number(bid.courierRating) || 5.0).toFixed(1)})`;

        setActiveNotification({
          id: `bid_active`,
          type: 'BID',
          title,
          message,
        });

        notificationService.showSystemNotification({
          title,
          body: message,
          sound: true,
        });

        return next;
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
      notificationService.showSystemNotification({
        title: '🎉 ¡Conductor Confirmado!',
        body: `${payload.courier.fullName} se dirige al punto de recogida.`,
        sound: true,
      });
    };

    const handleStatusChange = (data: SocketOrderStatusChangePayload) => {
      const current = activeOrderRef.current;
      if (current && current.id === data.orderId) {
        setActiveOrder((prev) => (prev ? { ...prev, status: data.newStatus } : null));
        soundNotification.playChime();

        let statusText = 'El estado de tu viaje ha cambiado.';
        if (data.newStatus === 'ARRIVED_AT_ORIGIN') statusText = '📍 ¡El conductor ha llegado al punto de recogida!';
        else if (data.newStatus === 'PICKED_UP') statusText = '📦 Tu paquete o pedido ha sido recogido por el conductor.';
        else if (data.newStatus === 'IN_TRANSIT') statusText = '🚀 El conductor va en camino hacia la entrega final.';

        setActiveNotification({
          id: `status_${data.newStatus}`,
          type: 'STATUS',
          title: '🛵 Actualización del Viaje',
          message: statusText,
        });
        notificationService.showSystemNotification({
          title: '🛵 Actualización del Viaje',
          body: statusText,
          sound: true,
        });
      }
    };

    const handleChatReceive = (msg: any) => {
      if (msg.senderId !== user?.id) {
        // Evitar procesar el mismo mensaje dos veces en pantalla
        if (msg.id && lastChatMsgIdRef.current === msg.id) return;
        lastChatMsgIdRef.current = msg.id || null;

        soundNotification.playMessageTone();
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
        notificationService.showSystemNotification({
          title: `💬 Mensaje de ${msg.senderName || 'Conductor'}`,
          body: msg.content,
          sound: true,
          channelType: 'MESSAGES',
          soundType: 'MESSAGE',
          data: { orderId: msg.orderId },
        });
      }
    };

    const handleLocationFeed = (feed: { orderId: string; latitude: number; longitude: number; bearing?: number }) => {
      const current = activeOrderRef.current;
      if (!current || feed.orderId === current.id) {
        setCourierLocation({ latitude: feed.latitude, longitude: feed.longitude, bearing: feed.bearing });

        // Verificación de Desvío de Ruta en tiempo real
        if (
          current &&
          (current.status === 'ACCEPTED' ||
            current.status === 'ARRIVED_AT_ORIGIN' ||
            current.status === 'PICKED_UP' ||
            current.status === 'IN_TRANSIT')
        ) {
          const routeToCheck =
            activeRouteCoordsRef.current.length > 0
              ? activeRouteCoordsRef.current
              : current.originPoint && current.destinationPoint
              ? [
                  [current.originPoint.longitude, current.originPoint.latitude] as [number, number],
                  [current.destinationPoint.longitude, current.destinationPoint.latitude] as [number, number],
                ]
              : [];

          if (routeToCheck.length >= 2) {
            const check = routeDeviationService.checkDeviation(
              { latitude: feed.latitude, longitude: feed.longitude },
              routeToCheck,
              current.destinationPoint,
              450 // Margen de 450 metros
            );

            if (check.isDeviated) {
              consecutiveDeviationsRef.current += 1;
              if (consecutiveDeviationsRef.current >= 2) {
                // Al menos 2 pings consecutivos para descartar saltos temporales
                setDeviationAlert({
                  visible: true,
                  distanceMeters: Math.round(check.distanceMeters),
                });
                soundNotification.playChime();
              }
            } else {
              consecutiveDeviationsRef.current = 0;
            }
          }
        }
      }
    };

    const handleCompleted = () => {
      soundNotification.playChime();
      const current = activeOrderRef.current;
      if (current) {
        setCompletedOrderId(current.id);
      }
      setRatingTargetName(assignedCourier?.fullName || 'tu conductor');
      setRatingVisible(true);
      setActiveOrder(null);
      setCourierLocation(null);
      setAssignedCourier(null);
      setIncomingBids([]);

      // Limpiar mapa y trazabilidad por completo: dejar solo ubicación GPS
      setDestPoint(null);
      setDestAddress('');
      setActiveRouteCoords([]);
      setIntermediateStops([]);

      setActiveNotification({
        id: `completed_${Date.now()}`,
        type: 'STATUS',
        title: '🏁 ¡Servicio Completado!',
        message: 'Tu pedido ha llegado a su destino. ¡Gracias por usar DOMY!',
      });
    };

    const handleCancelled = (payload: { orderId: string }) => {
      const current = activeOrderRef.current;
      if (current && current.id === payload.orderId) {
        setActiveOrder(null);
        setIncomingBids([]);
        setCourierLocation(null);
        setAssignedCourier(null);

        // Limpiar mapa y ruta
        setDestPoint(null);
        setDestAddress('');
        setActiveRouteCoords([]);
        setIntermediateStops([]);

        setActiveNotification({
          id: `cancelled_${Date.now()}`,
          type: 'STATUS',
          title: '⚠️ Solicitud Cancelada',
          message: 'Tu servicio ha sido cancelado.',
        });
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
  }, [activeOrder?.id]);

  // 4. Crear Orden
  const handleCreateOrder = async () => {
    if (!destPoint || !destAddress.trim()) {
      const msg = 'Por favor ingresa o selecciona la dirección de destino en el mapa.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Destino Requerido', msg);
      return;
    }

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
        estimatedPurchaseCost: serviceType === 'ERRAND' ? Number(estimatedPurchase.replace(/\D/g, '') || 0) : 0,
        offeredPrice: Number(offeredPrice.replace(/\D/g, '') || 0),
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
  const executeCancel = async () => {
    if (!activeOrder) return;
    setCancelling(true);
    try {
      await api.post(`/api/orders/${activeOrder.id}/cancel`);
      setActiveOrder(null);
      setIncomingBids([]);
      setCourierLocation(null);
      setAssignedCourier(null);
      setDestPoint(null);
      setDestAddress('');
      setActiveRouteCoords([]);
      setIntermediateStops([]);
      setActiveNotification({
        id: `cancelled_client_${Date.now()}`,
        type: 'STATUS',
        title: 'Pedido Cancelado',
        message: 'Tu solicitud ha sido cancelada exitosamente.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cancelar el pedido';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setCancelling(false);
      setCancelConfirmVisible(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    setCancelConfirmVisible(true);
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
    const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://domiapp.adhsolutions.tech';
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
          {/* Botón de Sonido (Campana / Silencio) */}
          <TouchableOpacity
            onPress={() => {
              const nextState = soundNotification.toggleSound();
              setSoundEnabled(nextState);
            }}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/20 items-center justify-center active:bg-white/20"
            accessibilityLabel={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            <Text className="text-sm">{soundEnabled ? '🔔' : '🔕'}</Text>
          </TouchableOpacity>

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

      {/* Mitad Superior: Mapa Universal Interactivo con Cortina Desplegable */}
      <View className={`${isCurtainCollapsed ? 'h-[75%]' : 'h-[42%]'} w-full relative transition-all duration-300`}>
        <UniversalMap
          center={activeOrder?.originPoint || originPoint}
          origin={activeOrder?.originPoint || originPoint}
          destination={activeOrder?.destinationPoint || destPoint}
          intermediateStops={intermediateStops.map((s) => s.point)}
          courierLocation={courierLocation}
          userLocation={userLocation}
          nearbyCouriers={nearbyCouriers}
          isSearching={activeOrder?.status === 'SEARCHING'}
          darkMode={darkMode}
          onRouteCalculated={(coords) => setActiveRouteCoords(coords)}
          onMapClick={async (point) => {
            if (!activeOrder) {
              setDestPoint(point);
              setDestAddress('Obteniendo dirección...');
              try {
                const readable = await geocodingService.reverseGeocode(point);
                setDestAddress(readable || `Punto (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`);
              } catch {
                setDestAddress(`Punto seleccionado (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`);
              }
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
      <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
        {activeOrder ? (
          // Vista de Orden Activa con Cortina
          <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6">
            {/* Manija de Cortina Desplegable para expandir o contraer mapa */}
            <TouchableOpacity
              onPress={() => setIsCurtainCollapsed((prev) => !prev)}
              className="w-full items-center py-1 -mt-2 mb-2 active:opacity-60"
            >
              <View className="w-12 h-1.5 bg-slate-300 rounded-full mb-1" />
              <Text className="text-[11px] font-bold text-slate-500">
                {isCurtainCollapsed ? '🔼 Subir cortina (Ver detalles y chat)' : '🔽 Bajar cortina (Ver mapa amplio)'}
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {activeOrder.status === 'SEARCHING'
                    ? 'Buscando conductores...'
                    : activeOrder.status === 'ARRIVED_AT_ORIGIN'
                    ? '📍 En Origen'
                    : activeOrder.status === 'PICKED_UP' || activeOrder.status === 'IN_TRANSIT'
                    ? '🚀 En Ruta al Destino'
                    : 'En curso'}
                </Text>
              </View>
              <Text className="text-primary font-black text-lg">
                ${Number(activeOrder.agreedPrice || activeOrder.offeredPrice).toLocaleString('es-CO')} COP
              </Text>
            </View>

            {/* PIN de Seguridad OTP */}
            {activeOrder.deliveryPin && (
              <View className={`bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl ${isCurtainCollapsed ? 'py-2 px-3' : 'p-4'} my-2 items-center`}>
                <Text className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">
                  Tu PIN Secreto de Entrega
                </Text>
                <Text className={`${isCurtainCollapsed ? 'text-2xl tracking-[6px]' : 'text-4xl tracking-[10px]'} font-extrabold text-amber-950`}>
                  {activeOrder.deliveryPin}
                </Text>
                {!isCurtainCollapsed && (
                  <Text className="text-[11px] text-amber-700 mt-1.5 text-center">
                    Díctaselo al conductor únicamente cuando tengas tu paquete o servicio en mano.
                  </Text>
                )}
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
                    <TouchableOpacity
                      key={bid.bidId}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedCourierDetail({
                          courierId: bid.courierId,
                          name: bid.courierName,
                          avatarUrl: (bid as any).courierAvatarUrl,
                          rating: Number(bid.courierRating) || 5.0,
                          vehicleType: bid.vehicleType,
                          vehiclePlate: bid.vehiclePlate,
                          vehicleModel: (bid as any).vehicleModel,
                          vehicleColor: (bid as any).vehicleColor,
                        });
                        setSelectedBidPrice(Number(bid.bidAmount));
                        setSelectedBidId(bid.bidId);
                        setCourierDetailVisible(true);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                        {(bid as any).courierAvatarUrl ? (
                          <Image
                            source={{ uri: (bid as any).courierAvatarUrl }}
                            className="w-12 h-12 rounded-full border-2 border-primary"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center">
                            <Text className="text-white font-black text-base">
                              {(bid.courierName || 'C').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-black text-slate-900">{bid.courierName}</Text>
                          <Text className="text-xs text-slate-500">
                            ⭐ {(Number(bid.courierRating) || 5.0).toFixed(1)} • {bid.vehicleType} {bid.vehiclePlate || ''}
                          </Text>
                          {(bid as any).vehicleModel ? (
                            <Text className="text-[11px] text-slate-600 font-medium">
                              {(bid as any).vehicleModel} • {(bid as any).vehicleColor || 'Estándar'}
                            </Text>
                          ) : null}
                          <Text className="text-[10px] text-primary font-bold mt-0.5">
                            🔍 Toca para ver perfil completo
                          </Text>
                        </View>
                      </View>
                      <View className="items-end gap-1.5">
                        <Text className="text-base font-black text-slate-900">
                          ${Number(bid.bidAmount || 0).toLocaleString('es-CO')}
                        </Text>
                        <Button
                          title="Aceptar"
                          variant="primary"
                          onPress={() => handleAcceptBid(bid.bidId)}
                          className="py-1 px-3.5"
                        />
                      </View>
                    </TouchableOpacity>
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
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedCourierDetail({
                          courierId: assignedCourier?.id,
                          name: assignedCourier?.fullName || 'Conductor Asignado',
                          avatarUrl: assignedCourier?.avatarUrl,
                          rating: Number(assignedCourier?.ratingAvg) || 5.0,
                          vehicleType: assignedCourier?.vehicleType,
                          vehiclePlate: assignedCourier?.vehiclePlate,
                          vehicleModel: assignedCourier?.vehicleModel,
                          vehicleColor: assignedCourier?.vehicleColor,
                        });
                        setCourierDetailVisible(true);
                      }}
                      className="flex-row items-center gap-3 flex-1"
                    >
                      {assignedCourier?.avatarUrl ? (
                        <Image
                          source={{ uri: assignedCourier.avatarUrl }}
                          className="w-12 h-12 rounded-full border-2 border-primary"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-12 h-12 rounded-full bg-secondary items-center justify-center">
                          <Text className="text-xl">🛵</Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-sm font-extrabold text-slate-900">
                          {assignedCourier?.fullName || 'Conductor Asignado'}
                        </Text>
                        <Text className="text-xs text-slate-500">
                          {assignedCourier?.vehicleType || 'MOTO'} • Placa: <Text className="font-bold text-slate-800">{assignedCourier?.vehiclePlate || 'N/A'}</Text>
                        </Text>
                        {assignedCourier?.vehicleModel && (
                          <Text className="text-[11px] text-slate-600 font-medium">
                            {assignedCourier.vehicleModel} • {assignedCourier.vehicleColor || ''}
                          </Text>
                        )}
                        <Text className="text-[10px] text-primary font-bold mt-0.5">
                          🔍 Ver perfil y detalles
                        </Text>
                      </View>
                    </TouchableOpacity>

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
                  {/* El botón de cancelar servicio desaparece una vez que el conductor ya recogió o va en ruta */}
                  {activeOrder.status !== 'PICKED_UP' && activeOrder.status !== 'IN_TRANSIT' && activeOrder.status !== 'COMPLETED' && (
                    <Button
                      title="❌ Cancelar Servicio"
                      variant="outline"
                      onPress={handleCancelOrder}
                      loading={cancelling}
                      className="border-rose-300 text-rose-600"
                    />
                  )}
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
              placeholder="¿A dónde vas? Escribe dirección, lugar o toca en el mapa..."
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
                  value={
                    estimatedPurchase
                      ? parseInt(estimatedPurchase.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO')
                      : ''
                  }
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, '');
                    setEstimatedPurchase(clean);
                  }}
                  placeholder="Ej: 25.000"
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

            <View className="mb-2">
              <Input
                label="Tu Oferta de Tarifa ($ COP) *"
                keyboardType="numeric"
                value={
                  offeredPrice
                    ? parseInt(offeredPrice.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO')
                    : ''
                }
                onChangeText={(val) => {
                  const clean = val.replace(/\D/g, '');
                  setOfferedPrice(clean);
                }}
                placeholder="Ej: 3.000"
              />

              {/* Chips rápidos con tarifas habituales colombianas */}
              <Text className="text-[10px] text-slate-500 font-bold mt-1.5 mb-1 uppercase">
                Sugerencias rápidas:
              </Text>
              <View className="flex-row items-center gap-1.5 flex-wrap">
                {[3000, 5000, 8000, 10000, 15000, 20000].map((preset) => {
                  const isSelected = offeredPrice === preset.toString();
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => setOfferedPrice(preset.toString())}
                      className={`px-3 py-1.5 rounded-xl border ${
                        isSelected
                          ? 'bg-primary border-primary shadow-sm'
                          : 'bg-slate-100 border-slate-300 active:bg-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white font-black' : 'text-slate-800'
                        }`}
                      >
                        ${preset.toLocaleString('es-CO')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

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
        onOpenProfile={() => setProfileModalVisible(true)}
        onOpenChats={() => setChatsModalVisible(true)}
        onOpenHistory={() => setHistoryVisible(true)}
        onOpenPqr={() => setPqrModalVisible(true)}
        onLogout={handleLogout}
        unreadChatsCount={unreadChatsCount}
      />

      <ProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />

      <CourierDetailModal
        visible={courierDetailVisible}
        courier={selectedCourierDetail}
        onClose={() => {
          setCourierDetailVisible(false);
          setSelectedCourierDetail(null);
          setSelectedBidId(null);
          setSelectedBidPrice(undefined);
        }}
        isOfferSelection={Boolean(selectedBidId)}
        bidPrice={selectedBidPrice}
        onSelectBid={() => {
          if (selectedBidId) handleAcceptBid(selectedBidId);
        }}
      />

      <RatingModal
        visible={ratingVisible}
        targetName={ratingTargetName}
        onSubmit={handleRateSubmit}
        onClose={() => setRatingVisible(false)}
      />

      <HistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        isCourier={false}
        onSelectActiveOrder={handleSelectActiveOrderFromHistory}
        onOpenPqr={(orderId) => {
          setSelectedPqrOrderId(orderId);
          setHistoryVisible(false);
          setPqrModalVisible(true);
        }}
        onRateOrder={(orderId, counterpartName) => {
          setCompletedOrderId(orderId);
          setRatingTargetName(counterpartName || 'tu conductor');
          setRatingVisible(true);
        }}
      />

      {/* Cuadro de Confirmación de Cancelación con Estilo DOMY */}
      <ConfirmationDialog
        visible={cancelConfirmVisible}
        title="Cancelar Solicitud"
        message="¿Estás seguro de que deseas cancelar este servicio? El conductor asignado será notificado."
        confirmText="Sí, Cancelar"
        cancelText="No, Continuar"
        type="danger"
        icon="🛑"
        loading={cancelling}
        onConfirm={executeCancel}
        onCancel={() => setCancelConfirmVisible(false)}
      />

      {/* Modal de Aviso de Actualización de APK */}
      <UpdatePromptModal
        visible={updatePromptVisible}
        versionInfo={versionInfo}
        onClose={() => setUpdatePromptVisible(false)}
      />

      <PqrModal
        visible={pqrModalVisible}
        orderId={selectedPqrOrderId || activeOrder?.id || ''}
        isCourier={false}
        onClose={() => {
          setPqrModalVisible(false);
          setSelectedPqrOrderId('');
        }}
        onOpenHistory={() => setHistoryVisible(true)}
      />

      {/* Modal de Alerta de Desvío de Ruta (Seguridad y Notificación al Cliente) */}
      <UniversalDialog
        visible={deviationAlert.visible}
        onClose={() => setDeviationAlert((prev) => ({ ...prev, visible: false }))}
        maxWidth={380}
      >
        <View className="w-full">
          <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center self-center mb-3">
            <Text className="text-3xl">⚠️</Text>
          </View>

          <Text className="text-xl font-black text-slate-900 text-center mb-1">
            Alerta de Desvío de Ruta
          </Text>

          <Text className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
            Detectamos que el conductor se ha alejado{' '}
            <Text className="font-extrabold text-amber-700">
              ~{deviationAlert.distanceMeters} metros
            </Text>{' '}
            del trayecto oficial pactado hacia tu destino. ¿Deseas verificar la ruta, contactarlo o alertar a seguridad?
          </Text>

          <View className="gap-2">
            {assignedCourier?.phone ? (
              <Button
                title="📞 Llamar al Conductor"
                variant="primary"
                onPress={() => {
                  Linking.openURL(`tel:${assignedCourier.phone}`).catch(() => {});
                }}
                className="py-2.5"
              />
            ) : null}

            <Button
              title="💬 Enviar Mensaje por Chat"
              variant="outline"
              onPress={() => {
                setDeviationAlert((prev) => ({ ...prev, visible: false }));
                setSelectedChatOrderId(activeOrder?.id || null);
                setSelectedChatCounterpart(assignedCourier?.fullName || 'Conductor');
                setChatVisible(true);
              }}
              className="py-2.5"
            />

            <Button
              title="🚨 Llamar a la Policía (Línea 123)"
              variant="danger"
              onPress={() => {
                Linking.openURL('tel:123').catch(() => {});
              }}
              className="py-2.5"
            />

            <Button
              title="📲 Compartir Alerta SOS por WhatsApp"
              variant="secondary"
              onPress={() => {
                const trackingUrl =
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/track/${activeOrder?.id}`
                    : `https://domy.app/track/${activeOrder?.id}`;
                const text = encodeURIComponent(
                  `⚠️ ¡ALERTA DE SEGURIDAD! El conductor de mi viaje DOMY se ha desviado ~${deviationAlert.distanceMeters}m de la ruta hacia el destino. Sigue mi trayecto en vivo aquí: ${trackingUrl}`
                );
                Linking.openURL(`https://wa.me/?text=${text}`).catch(() => {});
              }}
              className="py-2.5"
            />

            {activeOrder?.status === 'ACCEPTED' && (
              <Button
                title="❌ Cancelar Servicio (Conductor desviado)"
                variant="outline"
                onPress={() => {
                  setDeviationAlert((prev) => ({ ...prev, visible: false }));
                  handleCancelOrder();
                }}
                className="border-rose-400 text-rose-600 py-2.5"
              />
            )}

            <Button
              title="Entendido (Ruta acordada)"
              variant="outline"
              onPress={() => setDeviationAlert((prev) => ({ ...prev, visible: false }))}
              className="mt-1 py-2"
            />
          </View>
        </View>
      </UniversalDialog>
    </View>
  );
}
