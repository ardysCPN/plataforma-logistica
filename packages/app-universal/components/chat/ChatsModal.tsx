import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { UniversalBottomSheet } from '../common/UniversalBottomSheet';
import { api } from '../../services/api';

export interface ChatConversation {
  orderId: string;
  serviceType: string;
  orderStatus: string;
  originAddress: string;
  destinationAddress: string;
  orderCreatedAt: string;
  counterpartName: string;
  counterpartPhone: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
}

interface ChatsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectChat: (orderId: string, counterpartName: string) => void;
}

export const ChatsModal: React.FC<ChatsModalProps> = ({
  visible,
  onClose,
  onSelectChat,
}) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadConversations();
    }
  }, [visible]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get<ChatConversation[]>('/api/chat/my-chats');
      if (Array.isArray(res.data)) {
        setConversations(res.data);
      }
    } catch (err) {
      console.warn('Error cargando conversaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SEARCHING':
        return <Text className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Buscando</Text>;
      case 'ACCEPTED':
      case 'ARRIVED_AT_ORIGIN':
      case 'PICKED_UP':
      case 'IN_TRANSIT':
        return <Text className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">En Curso</Text>;
      case 'COMPLETED':
        return <Text className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">Completado</Text>;
      case 'CANCELLED':
        return <Text className="text-[10px] bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded-full">Cancelado</Text>;
      default:
        return null;
    }
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <UniversalBottomSheet visible={visible} onClose={onClose} maxHeight="85%">
      <View className="p-5 flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl">💬</Text>
              <View>
                <Text className="text-lg font-black text-slate-900">Mensajes y Chats</Text>
                <Text className="text-xs text-slate-500">Historial de conversaciones por servicio</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            >
              <Text className="font-bold text-slate-600">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Chats */}
          <ScrollView
            className="py-2"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF6B00" />
                <Text className="text-xs text-slate-400 mt-2">Cargando conversaciones...</Text>
              </View>
            ) : conversations.length === 0 ? (
              <View className="py-12 items-center">
                <Text className="text-4xl mb-2">📭</Text>
                <Text className="text-sm font-bold text-slate-700">No tienes chats registrados</Text>
                <Text className="text-xs text-slate-400 text-center mt-1 px-6">
                  Cuando solicites o tomes un servicio, podrás chatear directamente aquí.
                </Text>
              </View>
            ) : (
              conversations.map((c) => {
                const isRecent = c.orderStatus !== 'COMPLETED' && c.orderStatus !== 'CANCELLED';

                return (
                  <TouchableOpacity
                    key={c.orderId}
                    activeOpacity={0.7}
                    onPress={() => {
                      onClose();
                      onSelectChat(c.orderId, c.counterpartName);
                    }}
                    className={`p-3.5 rounded-2xl mb-2 flex-row items-center gap-3 border ${
                      isRecent ? 'bg-orange-50/40 border-orange-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <View className="w-12 h-12 rounded-full bg-slate-200 items-center justify-center font-bold">
                      <Text className="text-lg">
                        {c.serviceType === 'DELIVERY' ? '📦' : c.serviceType === 'ERRAND' ? '🛒' : '🛵'}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
                          {c.counterpartName}
                        </Text>
                        <Text className="text-[11px] text-slate-400">
                          {formatTime(c.lastMessageAt || c.orderCreatedAt)}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2 mt-0.5">
                        {getStatusBadge(c.orderStatus)}
                        <Text className="text-[11px] text-slate-500 flex-1" numberOfLines={1}>
                          {c.destinationAddress}
                        </Text>
                      </View>

                      <Text
                        className={`text-xs mt-1 ${c.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}
                        numberOfLines={1}
                      >
                        {c.lastMessage ? `"${c.lastMessage}"` : 'Toca para abrir la conversación...'}
                      </Text>
                    </View>

                    {c.unreadCount > 0 && (
                      <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                        <Text className="text-[10px] font-black text-white">{c.unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
      </View>
    </UniversalBottomSheet>
  );
};
