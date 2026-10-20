import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function IndexScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();

  useEffect(() => {
    // Redirección inteligente basada en sesión y rol
    const timeout = setTimeout(() => {
      if (!token || !user) {
        router.replace('/(auth)/login');
      } else if (user.role === 'CLIENT') {
        router.replace('/(client)');
      } else if (user.role === 'COURIER') {
        router.replace('/(courier)');
      } else if (user.role === 'ADMIN') {
        router.replace('/(admin)');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [user, token]);

  return (
    <View className="flex-1 bg-secondary items-center justify-center p-6">
      <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center mb-6 shadow-2xl">
        <Text className="text-4xl font-extrabold text-white">⚡</Text>
      </View>
      <Text className="text-2xl font-bold text-white mb-2 tracking-tight">
        Plataforma Logística
      </Text>
      <Text className="text-sm text-slate-400 mb-8">
        Movilidad y Entregas Inteligentes
      </Text>
      <ActivityIndicator size="large" color="#FF6B00" />
    </View>
  );
}
