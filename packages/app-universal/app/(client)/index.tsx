import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { UniversalMap } from '../../components/map/UniversalMap';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ChatModal } from '../../components/chat/ChatModal';
import { SosButton } from '../../components/common/SosButton';
import { RatingModal } from '../../components/common/RatingModal';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  ServiceType,
  ServiceOrder,
  OrderBid,
  GeoPoint,
  SOCKET_EVENTS,
  SocketBidReceivedPayload,
  SocketOrderAssignedPayload,
} from '@plataforma/shared';

export default function ClientHomeScreen() {
  const { user, logout } = useAuthStore();

  // Estados de solicitud
  const [serviceType, setServiceType] = useState<ServiceType>('DELIVERY');
  const [originAddress, setOriginAddress] = useState('Calle 10 # 43E-20, El Poblado');
  const [originPoint, setOriginPoint] = useState<GeoPoint>({ latitude: 6.2085, longitude: -75.5678 });
  const [destAddress, setDestAddress] = useState('Carrera 43A # 1-50, San Fernando');
  const [destPoint, setDestPoint] = useState<GeoPoint>({ latitude: 6.2012, longitude: -75.5721 });
  const [description, setDescription] = useState('');
  const [estimatedPurchase, setEstimatedPurchase] = useState('25000');
  const [offeredPrice, setOfferedPrice] = useState('8000');

  // Estado de orden activa
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  const [incomingBids, setIncomingBids] = useState<SocketBidReceivedPayload[]>([]);
  const [courierLocation, setCourierLocation] = useState<{ latitude: number; longitude: number; bearing?: number } | null>(null);

  // Modales
  const [chatVisible, setChatVisible] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleBidReceived = (bid: SocketBidReceivedPayload) => {
      setIncomingBids((prev) => [bid, ...prev.filter((b) => b.courierId !== bid.courierId)]);
    };

    const handleAssigned = (payload: SocketOrderAssignedPayload) => {
      setActiveOrder((prev) => (prev ? { ...prev, status: 'ACCEPTED', agreedPrice: payload.agreedPrice } : null));
      setIncomingBids([]);
    };

    const handleLocationFeed = (feed: { orderId: string; latitude: number; longitude: number; bearing?: number }) => {
      if (activeOrder && feed.orderId === activeOrder.id) {
        setCourierLocation({ latitude: feed.latitude, longitude: feed.longitude, bearing: feed.bearing });
      }
    };

    const handleCompleted = () => {
      setRatingVisible(true);
      setActiveOrder(null);
      setCourierLocation(null);
    };

    socket.on(SOCKET_EVENTS.BID_RECEIVED, handleBidReceived);
    socket.on(SOCKET_EVENTS.ORDER_ASSIGNED, handleAssigned);
    socket.on(SOCKET_EVENTS.LOCATION_CLIENT_FEED, handleLocationFeed);
    socket.on(SOCKET_EVENTS.ORDER_COMPLETED, handleCompleted);

    return () => {
      socket.off(SOCKET_EVENTS.BID_RECEIVED, handleBidReceived);
      socket.off(SOCKET_EVENTS.ORDER_ASSIGNED, handleAssigned);
      socket.off(SOCKET_EVENTS.LOCATION_CLIENT_FEED, handleLocationFeed);
      socket.off(SOCKET_EVENTS.ORDER_COMPLETED, handleCompleted);
    };
  }, [activeOrder]);

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const res = await api.post<ServiceOrder>('/api/orders', {
        serviceType,
        originAddress,
        originPoint,
        destinationAddress: destAddress,
        destinationPoint: destPoint,
        descriptionNotes: description || undefined,
        estimatedPurchaseCost: serviceType === 'ERRAND' ? Number(estimatedPurchase) : 0,
        offeredPrice: Number(offeredPrice),
      });

      setActiveOrder(res.data);
      setIncomingBids([]);

      const socket = getSocket();
      socket.emit('order:join', res.data.id);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bidId: string) => {
    if (!activeOrder) return;
    try {
      await api.post('/api/bids/accept', {
        orderId: activeOrder.id,
        bidId,
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo aceptar la oferta');
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Mitad Superior: Mapa Universal */}
      <View className="h-[40%] w-full relative">
        <UniversalMap
          center={originPoint}
          origin={originPoint}
          destination={destPoint}
          courierLocation={courierLocation}
        />
        {activeOrder && (
          <View className="absolute top-12 right-4 z-10">
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
                  <Text className="text-xs text-slate-400 py-4 text-center">
                    Transmitiendo tu pedido a conductores cercanos...
                  </Text>
                ) : (
                  incomingBids.map((bid) => (
                    <View
                      key={bid.bidId}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-sm font-bold text-slate-900">{bid.courierName}</Text>
                        <Text className="text-xs text-slate-500">
                          ⭐ {bid.courierRating.toFixed(1)} • {bid.vehicleType} {bid.vehiclePlate || ''}
                        </Text>
                        {bid.etaMinutes && (
                          <Text className="text-xs text-emerald-600 font-semibold mt-0.5">
                            Llega en ~{bid.etaMinutes} mins
                          </Text>
                        )}
                      </View>
                      <View className="items-end gap-1.5">
                        <Text className="text-base font-black text-slate-900">
                          ${bid.bidAmount} COP
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
              </View>
            )}

            {/* Botón de Chat si ya está asignado */}
            {activeOrder.status !== 'SEARCHING' && (
              <Button
                title="💬 Abrir Chat con el Conductor"
                variant="secondary"
                onPress={() => setChatVisible(true)}
                className="mt-3"
              />
            )}
          </View>
        ) : (
          // Formulario de Solicitud de Servicio
          <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6">
            <Text className="text-xl font-extrabold text-slate-900 mb-4">
              ¿Qué necesitas hoy?
            </Text>

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

            <Input
              label="Punto de Recogida / Salida"
              value={originAddress}
              onChangeText={setOriginAddress}
            />

            <Input
              label="Punto de Entrega / Destino"
              value={destAddress}
              onChangeText={setDestAddress}
            />

            {serviceType === 'ERRAND' ? (
              <>
                <Input
                  label="Lista de Compras o Encargo"
                  placeholder="Ej. Leche, pan y medicina en la farmacia de la esquina"
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
      {activeOrder && (
        <ChatModal
          visible={chatVisible}
          orderId={activeOrder.id}
          currentUserId={user?.id || ''}
          counterpartName="Conductor Asignado"
          onClose={() => setChatVisible(false)}
        />
      )}

      <RatingModal
        visible={ratingVisible}
        targetName="tu conductor"
        onSubmit={async (score, tags, comment) => {
          Alert.alert('¡Gracias!', 'Tu calificación ayuda a mantener segura la plataforma.');
        }}
        onClose={() => setRatingVisible(false)}
      />
    </View>
  );
}
