import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar, BackHandler, StyleSheet } from 'react-native';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { soundNotification } from '../../services/soundNotification';
import { ChatMessage, SOCKET_EVENTS } from '@plataforma/shared';

interface ChatModalProps {
  visible: boolean;
  orderId: string;
  currentUserId: string;
  counterpartName: string;
  onClose: () => void;
}

const QUICK_NOTES = [
  'Ya voy en camino 🛵',
  '¡Ya llegué al punto! 📍',
  'Estoy esperando afuera',
  '¿Alguna indicación adicional?',
];

export const ChatModal: React.FC<ChatModalProps> = ({
  visible,
  orderId,
  currentUserId,
  counterpartName,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;

    const backAction = () => {
      onClose();
      return true;
    };

    const handler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => handler.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible || !orderId) return;

    // Cargar historial previo
    api.get<ChatMessage[]>(`/api/chat/history/${orderId}`)
      .then((res) => {
        setMessages(res.data);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
      })
      .catch((err) => console.warn('Error cargando historial de chat:', err));

    const socket = getSocket();
    socket.emit('order:join', orderId);

    const handleMessage = (msg: ChatMessage) => {
      if (msg.orderId === orderId) {
        if (msg.senderId !== currentUserId) {
          soundNotification.playPop();
        }
        setMessages((prev) => {
          // Si ya existe exactamente con el mismo ID de base de datos
          if (prev.some((m) => m.id === msg.id)) return prev;

          // Si es un mensaje propio confirmado por el servidor, reemplazar el mensaje temporal
          if (msg.senderId === currentUserId) {
            const tempIdx = prev.findIndex((m) => m.id.startsWith('temp_') && m.content === msg.content);
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = msg;
              return updated;
            }
          }
          return [...prev, msg];
        });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    socket.on(SOCKET_EVENTS.CHAT_RECEIVE, handleMessage);

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_RECEIVE, handleMessage);
      socket.emit('order:leave', orderId);
    };
  }, [visible, orderId, currentUserId]);

  const handleSend = async (contentToSend?: string) => {
    const content = contentToSend || text.trim();
    if (!content) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      orderId,
      senderId: currentUserId,
      messageType: 'TEXT',
      content,
      createdAt: new Date().toISOString(),
    };

    // 1. Mostrar de inmediato el mensaje en la pantalla del usuario (Optimistic UI)
    setMessages((prev) => [...prev, optimisticMsg]);
    setText('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    setLoading(true);
    try {
      const socket = getSocket();
      socket.emit(SOCKET_EVENTS.CHAT_SEND, {
        orderId,
        messageType: 'TEXT',
        content,
      });
    } catch (err) {
      console.warn('Error enviando mensaje:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
          {/* Cabecera del Chat */}
          <View
            style={{
              paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 48,
            }}
            className="bg-secondary px-5 pb-4 flex-row items-center justify-between shadow-md"
          >
            <View>
              <Text className="text-white font-bold text-lg">{counterpartName}</Text>
              <Text className="text-xs text-emerald-400 font-medium">● Chat en tiempo real</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="bg-white/10 px-3.5 py-1.5 rounded-full active:bg-white/20"
            >
              <Text className="text-white text-xs font-semibold">Cerrar ✕</Text>
            </TouchableOpacity>
          </View>

        {/* Lista de Mensajes */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 p-4"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Text className="text-slate-400 text-sm">No hay mensajes aún.</Text>
              <Text className="text-slate-400 text-xs mt-1">Coordina los detalles de la entrega aquí.</Text>
            </View>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === currentUserId;
              return (
                <View
                  key={m.id}
                  className={`mb-3 max-w-[80%] rounded-2xl p-3.5 ${
                    isMine
                      ? 'self-end bg-primary text-white rounded-br-none'
                      : 'self-start bg-white border border-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  <Text
                    className={`text-sm leading-relaxed ${
                      isMine ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {m.content}
                  </Text>
                  <Text
                    className={`text-[10px] mt-1 text-right ${
                      isMine ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Notas Rápidas */}
        <View className="px-4 py-2 bg-slate-100 border-t border-slate-200">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 py-1">
            {QUICK_NOTES.map((note) => (
              <TouchableOpacity
                key={note}
                onPress={() => handleSend(note)}
                className="bg-white border border-slate-300 rounded-full px-3 py-1.5 mr-2 shadow-sm active:bg-slate-50"
              >
                <Text className="text-xs text-slate-700 font-medium">{note}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Campo de Entrada de Texto */}
        <View className="p-3 bg-white border-t border-slate-200 flex-row items-center gap-2">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#94A3B8"
            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-slate-900 text-base"
          />
          <Button
            title="Enviar"
            onPress={() => handleSend()}
            loading={loading}
            className="px-4 py-3"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
    zIndex: 99995,
    elevation: 30,
  },
});
