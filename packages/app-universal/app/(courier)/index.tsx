import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform, Linking, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { UniversalMap } from '../../components/map/UniversalMap';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PinModal } from '../../components/common/PinModal';
import { ChatModal } from '../../components/chat/ChatModal';
import { ChatsModal } from '../../components/chat/ChatsModal';
import { HistoryModal } from '../../components/common/HistoryModal';
import { PqrModal } from '../../components/common/PqrModal';
import { AppDrawer } from '../../components/common/AppDrawer';
import { NotificationBanner, BannerNotification } from '../../components/common/NotificationBanner';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { locationTracker } from '../../services/locationTracker';
import {
  ServiceOrder,
  SOCKET_EVENTS,
  SocketOrderNewAvailablePayload,
  SocketCorridorAlertPayload,
  SocketOrderAssignedPayload,
  GeoPoint,
} from '@plataforma/shared';

export default function CourierHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [availableOrders, setAvailableOrders] = useState<SocketOrderNewAvailablePayload[]>([]);
  const [corridorAlerts, setCorridorAlerts] = useState<SocketCorridorAlertPayload[]>([]);
  const [activeOrders, setActiveOrders] = useState<ServiceOrder[]>([]);
  const [courierLocation, setCourierLocation] = useState<GeoPoint | null>(() => locationTracker.getCachedLocation());
  const [submittedBids, setSubmittedBids] = useState<Record<string, number>>({});
  const [locatingGps, setLocatingGps] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SocketOrderNewAvailablePayload | null>(null);
  const lastChatMsgIdRef = useRef<string | null>(null);

  // Modo Oscuro (Feature 7)
  const [darkMode, setDarkMode] = useState(false);

  // Modo Destino para el Conductor (Feature 4)
  const [targetDestination, setTargetDestination] = useState<string | null>(null);
  const [destModalVisible, setDestModalVisible] = useState(false);
  const [destCustomInput, setDestCustomInput] = useState('');
  const [onlyShowMatchingDest, setOnlyShowMatchingDest] = useState(false);

  // Modales y Notificaciones
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedOrderIdForPin, setSelectedOrderIdForPin] = useState<string | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatsModalVisible, setChatsModalVisible] = useState(false);
  const [selectedOrderIdForChat, setSelectedOrderIdForChat] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pqrModalVisible, setPqrModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeNotification, setActiveNotification] = useState<BannerNotification | null>(null);
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [loadingAction, setLoadingAction] = useState(false);
  const [counterOfferOrderId, setCounterOfferOrderId] = useState<string | null>(null);
  const [customCounterOffer, setCustomCounterOffer] = useState<string>('');

  // Capturar GPS explícitamente
  const handleCaptureGps = async () => {
    setLocatingGps(true);
    try {
      const granted = await locationTracker.requestPermissions();
      if (granted) {
        const loc = await locationTracker.getCurrentLocation();
        if (loc) {
          setCourierLocation(loc);
          locationTracker.startTracking(activeOrders.map((o) => o.id));
        }
      } else {
        const msg = 'Por favor habilita el permiso de ubicación en tu navegador o celular para poder trabajar.';
        if (Platform.OS === 'web') alert(msg);
        else Alert.alert('Ubicación requerida', msg);
      }
    } catch (err) {
      console.warn('Error al capturar GPS:', err);
    } finally {
      setLocatingGps(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Intentar obtener GPS inicial con caché
    const cached = locationTracker.getCachedLocation();
    if (cached && !courierLocation) {
      setCourierLocation(cached);
    }

    locationTracker.requestPermissions().then(async (granted) => {
      if (granted && isMounted) {
        const loc = await locationTracker.getCurrentLocation();
        if (loc && isMounted) {
          setCourierLocation({ latitude: loc.latitude, longitude: loc.longitude });
        }
        locationTracker.startTracking(activeOrders.map((o) => o.id));
      }
    });

    // Cargar órdenes disponibles en la zona
    api
      .get<SocketOrderNewAvailablePayload[]>('/api/orders/available')
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setAvailableOrders(res.data);
        }
      })
      .catch((err) => console.warn('Error cargando órdenes disponibles:', err));

    // Cargar órdenes activas previas asignadas al conductor (Persistencia ante recarga)
    api
      .get<ServiceOrder[]>('/api/orders/my-active')
      .then((res) => {
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setActiveOrders(res.data);
          const socket = getSocket();
          res.data.forEach((o) => socket.emit('order:join', o.id));
          locationTracker.startTracking(res.data.map((o) => o.id));
        }
      })
      .catch((err) => console.warn('No hay órdenes activas asignadas:', err));

    const socket = getSocket();

    const handleNewOrder = (order: SocketOrderNewAvailablePayload) => {
      setAvailableOrders((prev) => [order, ...prev.filter((o) => o.orderId !== order.orderId)]);
    };

    const handleCorridorAlert = (alert: SocketCorridorAlertPayload) => {
      setCorridorAlerts((prev) => [alert, ...prev.filter((a) => a.orderId !== alert.orderId)]);
    };

    const handleOrderCancelled = (data: { orderId: string }) => {
      setAvailableOrders((prev) => prev.filter((o) => o.orderId !== data.orderId));
      setActiveOrders((prev) => prev.filter((o) => o.id !== data.orderId));
      setSubmittedBids((prev) => {
        const next = { ...prev };
        delete next[data.orderId];
        return next;
      });
    };

    // Al asignarse la orden al conductor
    const handleOrderAssigned = async (payload: SocketOrderAssignedPayload) => {
      if (payload.courier?.id === user?.id) {
        try {
          const res = await api.get<ServiceOrder>(`/api/orders/${payload.orderId}`);
          if (isMounted) {
            setActiveOrders((prev) => [res.data, ...prev.filter((o) => o.id !== payload.orderId)]);
            setAvailableOrders((prev) => prev.filter((o) => o.orderId !== payload.orderId));
            setSubmittedBids((prev) => {
              const next = { ...prev };
              delete next[payload.orderId];
              return next;
            });
            // 1. Unirse a la sala socket de la orden
            socket.emit('order:join', payload.orderId);
            // 2. Iniciar rastreo de ubicación de inmediato
            locationTracker.startTracking([payload.orderId]);
            // 3. Emitir notificación superior
            setActiveNotification({
              id: `assigned_${Date.now()}`,
              type: 'STATUS',
              title: '🎉 ¡Pedido Adjudicado!',
              message: 'El cliente ha aceptado tu tarifa. Dirígete al punto de recogida.',
            });
          }
        } catch {
          // Fallback
        }
      }
    };

    const handleChatReceive = (msg: any) => {
      if (msg.senderId !== user?.id) {
        if (msg.id && lastChatMsgIdRef.current === msg.id) return;
        lastChatMsgIdRef.current = msg.id || null;

        setUnreadChatsCount((prev) => prev + 1);
        if (!chatModalVisible) {
          setActiveNotification({
            id: `chat_${Date.now()}`,
            type: 'CHAT',
            title: `💬 Mensaje de ${msg.senderName || 'Cliente'}`,
            message: msg.content,
            onPress: () => {
              setSelectedOrderIdForChat(msg.orderId);
              setChatModalVisible(true);
            },
          });
        }
      }
    };

    socket.on(SOCKET_EVENTS.ORDER_NEW_AVAILABLE, handleNewOrder);
    socket.on(SOCKET_EVENTS.ORDER_CORRIDOR_ALERT, handleCorridorAlert);
    socket.on(SOCKET_EVENTS.ORDER_CANCELLED, handleOrderCancelled);
    socket.on(SOCKET_EVENTS.ORDER_ASSIGNED, handleOrderAssigned);
    socket.on(SOCKET_EVENTS.CHAT_RECEIVE, handleChatReceive);

    return () => {
      isMounted = false;
      socket.off(SOCKET_EVENTS.ORDER_NEW_AVAILABLE, handleNewOrder);
      socket.off(SOCKET_EVENTS.ORDER_CORRIDOR_ALERT, handleCorridorAlert);
      socket.off(SOCKET_EVENTS.ORDER_CANCELLED, handleOrderCancelled);
      socket.off(SOCKET_EVENTS.ORDER_ASSIGNED, handleOrderAssigned);
      socket.off(SOCKET_EVENTS.CHAT_RECEIVE, handleChatReceive);
      locationTracker.stopTracking();
    };
  }, [activeOrders, user?.id]);

  // Tomar mandado atómicamente
  const handleClaimErrand = async (orderId: string) => {
    setLoadingAction(true);
    try {
      const res = await api.post(`/api/bids/claim-errand/${orderId}`);
      if (Platform.OS === 'web') alert(res.data.message);
      else Alert.alert('¡Éxito!', res.data.message);

      setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      const orderRes = await api.get<ServiceOrder>(`/api/orders/${orderId}`);
      setActiveOrders((prev) => [orderRes.data, ...prev]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo adjudicar el mandado';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Aviso', msg);
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
      setSubmittedBids((prev) => ({ ...prev, [orderId]: offeredPrice }));
      if (Platform.OS === 'web') {
        alert(`Oferta de $${offeredPrice.toLocaleString()} COP enviada. Esperando confirmación del cliente.`);
      } else {
        Alert.alert('Oferta enviada', 'El cliente está evaluando tu propuesta.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar la oferta';
      if (Platform.OS === 'web') alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
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
      const msg = err instanceof Error ? err.message : 'Error actualizando estado';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  // Verificar PIN OTP para finalizar
  const handleVerifyPin = async (pin: string) => {
    if (!selectedOrderIdForPin) return;
    try {
      const res = await api.post('/api/orders/complete-pin', {
        orderId: selectedOrderIdForPin,
        pin,
      });
      const successMsg = `¡Entrega Exitosa! Comisión debitada: $${res.data.commissionDeducted} COP`;
      if (Platform.OS === 'web') alert(successMsg);
      else Alert.alert('¡Entrega Exitosa!', successMsg);

      setActiveOrders((prev) => prev.filter((o) => o.id !== selectedOrderIdForPin));
      setPinModalVisible(false);
      setSelectedOrderIdForPin(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PIN inválido';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  // Modo Destino: coincidencia de sector o dirección
  const checkDestMatch = (orderDest: string, target: string | null): boolean => {
    if (!target) return false;
    const cleanOrder = orderDest.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanTarget = target.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (cleanOrder.includes(cleanTarget) || cleanTarget.includes(cleanOrder)) return true;
    const words = cleanTarget.split(/[\s,.-]+/).filter((w) => w.length >= 4);
    return words.some((w) => cleanOrder.includes(w));
  };

  const processedOrders = availableOrders
    .filter((order) => {
      if (targetDestination && onlyShowMatchingDest) {
        return checkDestMatch(order.destinationAddress, targetDestination);
      }
      return true;
    })
    .sort((a, b) => {
      if (targetDestination) {
        const aMatch = checkDestMatch(a.destinationAddress, targetDestination) ? 1 : 0;
        const bMatch = checkDestMatch(b.destinationAddress, targetDestination) ? 1 : 0;
        return bMatch - aMatch;
      }
      return 0;
    });

  // Determinar ruta según fase activa o preview de orden disponible
  const currentActive = activeOrders[0];
  const isHeadingToPickup = currentActive && currentActive.status === 'ACCEPTED';
  const mapOrigin = isHeadingToPickup
    ? courierLocation || currentActive.originPoint
    : currentActive?.originPoint || previewOrder?.originPoint;
  const mapDestination = isHeadingToPickup
    ? currentActive?.originPoint
    : currentActive?.destinationPoint || previewOrder?.destinationPoint;

  return (
    <View className={`flex-1 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Notificación Superior Push-Like */}
      <NotificationBanner
        notification={activeNotification}
        onDismiss={() => setActiveNotification(null)}
      />

      {/* Barra Superior Móvil con Menú Hamburguesa */}
      <View className="bg-secondary px-4 py-3 pt-12 shadow-md z-20">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            {/* Botón Hamburguesa ☰ con alerta de no leídos */}
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
                ⚡ DOMY CONDUCTOR
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Text className="text-[11px] text-slate-300">Radar Activo • En Línea</Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push('/(courier)/wallet')}
              className="bg-primary/20 border border-primary/50 px-3 py-1.5 rounded-full flex-row items-center gap-1"
            >
              <Text className="text-primary font-bold text-xs">
                💰 ${user?.walletBalance || 0} COP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCaptureGps}
              disabled={locatingGps}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-sm"
            >
              {locatingGps ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-xs font-bold text-white">📍 GPS</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Franja de Modo Destino Activo (Feature 4) */}
      {targetDestination && (
        <View className="bg-emerald-700 px-4 py-2.5 flex-row items-center justify-between border-b border-emerald-600 shadow-sm">
          <View className="flex-1 mr-2 flex-row items-center gap-2">
            <Text className="text-white text-base">🎯</Text>
            <View className="flex-1">
              <Text className="text-white font-extrabold text-[11px] uppercase tracking-wider">
                Modo Destino Activo
              </Text>
              <Text className="text-emerald-100 text-xs font-medium" numberOfLines={1}>
                Priorizando pedidos hacia: <Text className="font-bold text-white">{targetDestination}</Text>
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setOnlyShowMatchingDest(!onlyShowMatchingDest)}
              className={`px-2.5 py-1 rounded-full border ${
                onlyShowMatchingDest ? 'bg-white' : 'bg-emerald-800/80 border-emerald-400'
              }`}
            >
              <Text className={`text-[11px] font-bold ${onlyShowMatchingDest ? 'text-emerald-800' : 'text-white'}`}>
                {onlyShowMatchingDest ? '✓ Solo Destino' : 'Ver Todos'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setTargetDestination(null);
                setOnlyShowMatchingDest(false);
              }}
              className="bg-black/30 px-2.5 py-1 rounded-full"
            >
              <Text className="text-white text-[11px] font-bold">✕ Quitar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

      {/* Mapa del Domiciliario y Enrutamiento por Calles con Modo Oscuro */}
      <View style={{ height: 280, width: '100%', position: 'relative' }}>
        <UniversalMap
          center={courierLocation || { latitude: 6.2442, longitude: -75.5812 }}
          zoom={14}
          darkMode={darkMode}
          userLocation={courierLocation}
          courierLocation={courierLocation}
          origin={mapOrigin}
          destination={mapDestination}
          orderMarkers={processedOrders.map((o) => ({
            id: o.orderId,
            latitude: o.originPoint?.latitude || 6.2442,
            longitude: o.originPoint?.longitude || -75.5812,
            price: o.offeredPrice,
            serviceType: o.serviceType,
          }))}
        />
      </View>

      {/* Contenido Principal */}
      <ScrollView className="flex-1 p-4">
        {/* Sección: Pedidos Activos en Curso */}
        {activeOrders.length > 0 && (
          <View className="mb-6">
            <Text className="text-base font-extrabold text-slate-900 mb-3">
              Entregas en Curso ({activeOrders.length}/3)
            </Text>
            {activeOrders.map((order) => {
              const isPickupPhase = order.status === 'ACCEPTED';
              const targetPoint = isPickupPhase ? order.originPoint : order.destinationPoint;

              return (
                <View
                  key={order.id}
                  className="bg-white border-2 border-primary/30 rounded-3xl p-5 mb-4 shadow-md"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-1.5">
                      <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <Text className="text-xs font-black text-primary uppercase">
                        {order.serviceType} • {order.status}
                      </Text>
                    </View>
                    <Text className="text-lg font-black text-slate-900">
                      ${order.agreedPrice || order.offeredPrice} COP
                    </Text>
                  </View>

                  <View className="bg-slate-50 p-3 rounded-2xl mb-3 border border-slate-100">
                    <Text className="text-xs text-slate-500">
                      {isPickupPhase ? '📍 Dirígete al Punto de Recogida:' : '🏁 Dirígete al Destino de Entrega:'}
                    </Text>
                    <Text className="text-sm font-bold text-slate-900 mt-0.5">
                      {isPickupPhase ? order.originAddress : order.destinationAddress}
                    </Text>
                    {order.descriptionNotes ? (
                      <Text className="text-xs text-slate-600 mt-1.5 italic">
                        Nota: "{order.descriptionNotes}"
                      </Text>
                    ) : null}
                  </View>

                  {/* Botones de Navegación Externa Waze / Google Maps */}
                  {targetPoint && (
                    <View className="flex-row gap-2 mb-3">
                      <TouchableOpacity
                        onPress={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${targetPoint.latitude},${targetPoint.longitude}&travelmode=driving`;
                          if (Platform.OS === 'web') window.open(url, '_blank');
                          else Linking.openURL(url).catch(() => {});
                        }}
                        className="flex-1 bg-blue-50 border border-blue-200 py-2 rounded-xl items-center flex-row justify-center gap-1"
                      >
                        <Text className="text-xs font-bold text-blue-700">🗺️ Google Maps</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          const url = `https://waze.com/ul?ll=${targetPoint.latitude},${targetPoint.longitude}&navigate=yes`;
                          if (Platform.OS === 'web') window.open(url, '_blank');
                          else Linking.openURL(url).catch(() => {});
                        }}
                        className="flex-1 bg-cyan-50 border border-cyan-200 py-2 rounded-xl items-center flex-row justify-center gap-1"
                      >
                        <Text className="text-xs font-bold text-cyan-700">🚙 Abrir Waze</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Acciones de Estado del Pedido */}
                  <View className="flex-row gap-2 mt-1">
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
                        title={
                          order.serviceType === 'TRANSPORT'
                            ? 'Pasajero a Bordo (Iniciar Recorrido) 🚀'
                            : 'Paquete Recogido (Iniciar Entrega) 📦'
                        }
                        variant="primary"
                        onPress={() => handleUpdateStatus(order.id, 'PICKED_UP')}
                        className="flex-1 py-2.5"
                      />
                    )}
                    {order.status === 'PICKED_UP' && (
                      <Button
                        title={
                          order.serviceType === 'TRANSPORT'
                            ? 'En Trayecto hacia el Destino 🏁'
                            : 'En Tránsito hacia Entrega 🛵'
                        }
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
                      className="px-4 py-2.5"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Sección: Radar de Pedidos Disponibles */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`text-base font-extrabold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Radar de Pedidos Cercanos {targetDestination ? `(${processedOrders.length})` : ''}
          </Text>
          {targetDestination && (
            <TouchableOpacity
              onPress={() => setDestModalVisible(true)}
              className="flex-row items-center gap-1 bg-emerald-500/20 px-2.5 py-1 rounded-full"
            >
              <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                🎯 {targetDestination}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {processedOrders.length === 0 ? (
          <View className={`border rounded-3xl p-8 items-center shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Text className="text-3xl mb-2">📡</Text>
            <Text className={`text-sm font-bold text-center mb-1 ${darkMode ? 'text-white' : 'text-slate-700'}`}>
              {targetDestination && onlyShowMatchingDest
                ? `No hay pedidos hacia "${targetDestination}" en este momento`
                : 'Escaneando la zona...'}
            </Text>
            <Text className={`text-xs text-center ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
              {targetDestination && onlyShowMatchingDest
                ? 'Puedes desactivar "Solo Destino" para ver todos los pedidos disponibles.'
                : 'Te avisaremos al instante cuando un cliente cercano solicite un servicio.'}
            </Text>
            {targetDestination && onlyShowMatchingDest && (
              <TouchableOpacity
                onPress={() => setOnlyShowMatchingDest(false)}
                className="mt-3 bg-emerald-600 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-bold text-xs">Ver Todos los Pedidos</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          processedOrders.map((order) => {
            const hasSubmitted = submittedBids[order.orderId];
            const isDestMatch = targetDestination ? checkDestMatch(order.destinationAddress, targetDestination) : false;

            return (
              <View
                key={order.orderId}
                className={`border rounded-3xl p-5 mb-3 shadow-sm ${
                  isDestMatch
                    ? darkMode
                      ? 'bg-slate-900 border-emerald-500 shadow-emerald-950'
                      : 'bg-emerald-50/50 border-emerald-400 shadow-emerald-100'
                    : darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* Badge de coincidencia con Modo Destino (Feature 4) */}
                {isDestMatch && (
                  <View className="bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-xl mb-3 flex-row items-center gap-2">
                    <Text className="text-xs">✨</Text>
                    <Text className={`text-xs font-black ${darkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                      ¡Te deja en tu camino hacia {targetDestination}! 🎯
                    </Text>
                  </View>
                )}

                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-base">
                      {order.serviceType === 'DELIVERY' ? '📦' : order.serviceType === 'ERRAND' ? '🛒' : '🛵'}
                    </Text>
                    <Text className={`text-xs font-bold uppercase ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {order.serviceType}
                    </Text>
                  </View>
                  <Text className="text-lg font-black text-primary">
                    ${order.offeredPrice?.toLocaleString()} COP
                  </Text>
                </View>

                <Text className={`text-xs mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  De: <Text className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{order.originAddress}</Text>
                </Text>
                <Text className={`text-xs font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                  A: <Text className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{order.destinationAddress}</Text>
                </Text>

                {/* Botón para previsualizar ruta en el mapa antes de aceptar */}
                <View className="flex-row items-center justify-between mb-3">
                  <TouchableOpacity
                    onPress={() => setPreviewOrder(previewOrder?.orderId === order.orderId ? null : order)}
                    className={`px-3 py-1 rounded-full border flex-row items-center gap-1.5 ${
                      previewOrder?.orderId === order.orderId
                        ? 'bg-blue-600 border-blue-600'
                        : darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <Text className={`text-[11px] font-bold ${
                      previewOrder?.orderId === order.orderId
                        ? 'text-white'
                        : darkMode
                        ? 'text-blue-400'
                        : 'text-blue-700'
                    }`}>
                      {previewOrder?.orderId === order.orderId ? '🗺️ Ocultar Ruta' : '🗺️ Ver Recorrido en Mapa'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {order.descriptionNotes ? (
                  <Text className={`text-xs p-2.5 rounded-xl mb-3 ${darkMode ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                    "{order.descriptionNotes}"
                  </Text>
                ) : null}

                {/* Si ya envió oferta para este pedido */}
                {hasSubmitted ? (
                  <View className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex-row items-center justify-between">
                    <View>
                      <Text className="text-xs font-bold text-amber-900">
                        ⏳ Oferta de ${hasSubmitted.toLocaleString()} COP enviada
                      </Text>
                      <Text className="text-[11px] text-amber-700">
                        Esperando que el cliente la evalúe...
                      </Text>
                    </View>
                  </View>
                ) : counterOfferOrderId === order.orderId ? (
                  <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mt-1">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs font-black text-slate-800">
                        Tu Contraoferta (Tarifa Base: ${order.offeredPrice.toLocaleString('es-CO')} COP):
                      </Text>
                      <TouchableOpacity
                        onPress={() => setCounterOfferOrderId(null)}
                        className="px-2 py-0.5 rounded-lg bg-slate-200 active:bg-slate-300"
                      >
                        <Text className="text-[11px] font-bold text-slate-600">✕ Cancelar</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Chips de sugerencias rápidas: +$500 (Sugerido), +$1.000, +$2.000, +$3.000 */}
                    <Text className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase">
                      Incrementos rápidos recomendados:
                    </Text>
                    <View className="flex-row items-center gap-1.5 mb-2.5 flex-wrap">
                      {[500, 1000, 2000, 3000].map((addAmount) => {
                        const totalAmount = order.offeredPrice + addAmount;
                        const isSelected = customCounterOffer === totalAmount.toString();
                        return (
                          <TouchableOpacity
                            key={addAmount}
                            onPress={() => setCustomCounterOffer(totalAmount.toString())}
                            className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 ${
                              isSelected
                                ? 'bg-primary border-primary shadow-sm'
                                : 'bg-white border-slate-300 active:bg-slate-100'
                            }`}
                          >
                            <Text
                              className={`text-xs font-black ${
                                isSelected ? 'text-white' : 'text-slate-800'
                              }`}
                            >
                              +${addAmount.toLocaleString('es-CO')}
                            </Text>
                            {addAmount === 500 && (
                              <Text
                                className={`text-[9px] font-extrabold px-1 py-0.5 rounded ${
                                  isSelected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                Sugerido
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Input para valor personalizado */}
                    <View className="mb-2.5">
                      <Input
                        label="O escribe el valor total que deseas cobrar ($ COP)"
                        keyboardType="numeric"
                        value={
                          customCounterOffer
                            ? parseInt(customCounterOffer.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO')
                            : ''
                        }
                        onChangeText={(val: string) => {
                          const clean = val.replace(/\D/g, '');
                          setCustomCounterOffer(clean);
                        }}
                        placeholder="Ej: 5.500"
                      />
                    </View>

                    <Button
                      title={`Enviar Contraoferta: $${(
                        parseInt(customCounterOffer.replace(/\D/g, '') || '0', 10)
                      ).toLocaleString('es-CO')} COP 🚀`}
                      variant="primary"
                      onPress={() => {
                        const finalAmount = parseInt(customCounterOffer.replace(/\D/g, ''), 10);
                        if (isNaN(finalAmount) || finalAmount <= 0) {
                          if (Platform.OS === 'web') alert('Por favor ingresa un monto válido');
                          else Alert.alert('Aviso', 'Por favor ingresa un monto válido');
                          return;
                        }
                        handleSubmitBid(order.orderId, finalAmount);
                        setCounterOfferOrderId(null);
                      }}
                      loading={loadingAction}
                      className="py-2.5"
                    />
                  </View>
                ) : (
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
                          title={`Aceptar Tarifa ($${order.offeredPrice.toLocaleString('es-CO')})`}
                          variant="primary"
                          onPress={() => handleSubmitBid(order.orderId, order.offeredPrice)}
                          loading={loadingAction}
                          className="flex-1 py-2.5"
                        />
                        <Button
                          title="Contraofertar 💬"
                          variant="outline"
                          onPress={() => {
                            setCounterOfferOrderId(order.orderId);
                            setCustomCounterOffer((order.offeredPrice + 500).toString());
                          }}
                          loading={loadingAction}
                          className="flex-1 py-2.5"
                        />
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal: Modo Destino para Conductor (Feature 4) */}
      <Modal
        visible={destModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDestModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className={`rounded-t-3xl p-6 shadow-2xl max-h-[85%] ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white'}`}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">🎯</Text>
                <View>
                  <Text className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Modo Destino
                  </Text>
                  <Text className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Prioriza pedidos en tu camino a casa o zona elegida
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setDestModalVisible(false)}
                className={`w-8 h-8 rounded-full items-center justify-center ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
              >
                <Text className={`font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sectores Rápidos Populares */}
            <Text className={`text-xs font-bold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Sectores Rápidos:
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {['🏠 Casa', '🏢 Centro', '🌳 El Poblado', '⛰️ Laureles', '🏙️ Bello', '🏬 Envigado', '🏭 Itagüí', '🏔️ Sabaneta'].map((sector) => {
                const name = sector.replace(/^[^\w]+/, '').trim();
                const isSelected = targetDestination?.toLowerCase() === name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={sector}
                    onPress={() => {
                      setTargetDestination(name);
                      setDestModalVisible(false);
                    }}
                    className={`border px-3 py-1.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500'
                        : darkMode
                        ? 'bg-slate-800 border-slate-700 active:bg-slate-700'
                        : 'bg-slate-100 border-slate-200 active:bg-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected
                          ? 'text-white font-bold'
                          : darkMode
                          ? 'text-slate-200'
                          : 'text-slate-800'
                      }`}
                    >
                      {sector}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Entrada personalizada de texto */}
            <Text className={`text-xs font-bold mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              O escribe un barrio o dirección:
            </Text>
            <View className="flex-row items-center gap-2 mb-4">
              <TextInput
                value={destCustomInput}
                onChangeText={setDestCustomInput}
                placeholder="Ej: Belén, Calasanz, Robledo..."
                placeholderTextColor="#94A3B8"
                className={`flex-1 border rounded-2xl px-4 py-3 text-sm ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
              <Button
                title="Fijar"
                variant="primary"
                onPress={() => {
                  if (destCustomInput.trim()) {
                    setTargetDestination(destCustomInput.trim());
                    setDestCustomInput('');
                    setDestModalVisible(false);
                  }
                }}
                className="px-4 py-3"
              />
            </View>

            {targetDestination && (
              <View className={`border p-3.5 rounded-2xl mb-4 flex-row items-center justify-between ${
                darkMode ? 'bg-emerald-950/40 border-emerald-800' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <View className="flex-1 mr-2">
                  <Text className={`text-xs font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-900'}`}>
                    Destino Activo: {targetDestination}
                  </Text>
                  <Text className={`text-[11px] ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    Los pedidos hacia este sector se destacan y ordenan primero.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTargetDestination(null);
                    setDestModalVisible(false);
                  }}
                  className="bg-red-500/20 px-3 py-1.5 rounded-full"
                >
                  <Text className="text-xs font-bold text-red-500">Desactivar</Text>
                </TouchableOpacity>
              </View>
            )}

            <Button
              title="Cerrar"
              variant="outline"
              onPress={() => setDestModalVisible(false)}
              className="w-full py-2.5"
            />
          </View>
        </View>
      </Modal>

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

      {/* Bandeja de Todos los Chats */}
      <ChatsModal
        visible={chatsModalVisible}
        onClose={() => setChatsModalVisible(false)}
        onSelectChat={(orderId) => {
          setSelectedOrderIdForChat(orderId);
          setChatModalVisible(true);
        }}
      />

      {/* Menú Lateral Hamburguesa del Conductor */}
      <AppDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={user}
        isCourier={true}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenChats={() => setChatsModalVisible(true)}
        onOpenHistory={() => setHistoryVisible(true)}
        onOpenDestinationMode={() => setDestModalVisible(true)}
        onOpenWallet={() => router.push('/(courier)/wallet')}
        onOpenPqr={() => setPqrModalVisible(true)}
        onLogout={() => {
          logout();
          router.replace('/(auth)/login');
        }}
        unreadChatsCount={unreadChatsCount}
      />

      <HistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        isCourier={true}
        onSelectActiveOrder={async (orderId) => {
          try {
            const res = await api.get<ServiceOrder>(`/api/orders/${orderId}`);
            if (res.data) {
              setActiveOrders((prev) => [res.data, ...prev.filter((o) => o.id !== orderId)]);
              const socket = getSocket();
              socket.emit('order:join', res.data.id);
              locationTracker.startTracking([res.data.id]);
            }
          } catch (err) {
            console.warn('Error al restaurar orden de conductor:', err);
          }
        }}
      />

      <PqrModal
        visible={pqrModalVisible}
        orderId={activeOrders[0]?.id || ''}
        isCourier={true}
        onClose={() => setPqrModalVisible(false)}
      />
    </View>
  );
}
