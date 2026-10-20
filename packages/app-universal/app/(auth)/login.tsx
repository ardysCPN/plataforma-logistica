import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu teléfono y contraseña');
      return;
    }

    try {
      await login({ phone, password });
      router.replace('/');
    } catch {
      // El error ya queda en el store
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-slate-50 px-6 py-12 justify-center">
      <View className="w-full max-w-md self-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <View className="mb-8">
          <Text className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Iniciar Sesión
          </Text>
          <Text className="text-sm text-slate-500">
            Ingresa a tu cuenta para continuar
          </Text>
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6">
            <Text className="text-danger text-xs font-semibold">{error}</Text>
          </View>
        )}

        <Input
          label="Número Celular"
          placeholder="Ej. 3001234567"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(val) => {
            setPhone(val);
            if (error) clearError();
          }}
        />

        <Input
          label="Contraseña"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) clearError();
          }}
        />

        <Button
          title="Ingresar"
          onPress={handleLogin}
          loading={isLoading}
          className="mt-2 mb-6"
        />

        <View className="flex-row justify-center items-center gap-1.5">
          <Text className="text-sm text-slate-500">¿No tienes cuenta?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-sm font-bold text-primary">Regístrate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
