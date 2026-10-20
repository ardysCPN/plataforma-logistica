import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';

export default function KycScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [idFrontSelected, setIdFrontSelected] = useState(false);
  const [idBackSelected, setIdBackSelected] = useState(false);
  const [selfieSelected, setSelfieSelected] = useState(false);
  const [vehicleDocSelected, setVehicleDocSelected] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!idFrontSelected || !idBackSelected || !selfieSelected) {
      Alert.alert('Documentos incompletos', 'Debes adjuntar al menos cédula frente/reverso y selfie');
      return;
    }
    setSubmitted(true);
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-slate-50 px-6 py-10">
      <View className="w-full max-w-md self-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <Text className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
          Verificación de Identidad (KYC)
        </Text>
        <Text className="text-sm text-slate-500 mb-6 leading-relaxed">
          Para garantizar la seguridad de la comunidad, sube las fotografías requeridas de tus documentos.
        </Text>

        {submitted ? (
          <View className="items-center py-6">
            <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">⏳</Text>
            </View>
            <Text className="text-lg font-bold text-slate-900 mb-2 text-center">
              Documentos en Revisión
            </Text>
            <Text className="text-sm text-slate-600 text-center leading-relaxed mb-6">
              Tus documentos han sido recibidos con éxito. Nuestro equipo administrativo los validará en breve (estado: PENDING_APPROVAL). Te notificaremos cuando tu cuenta sea activada.
            </Text>
            <Button
              title="Volver al Inicio"
              variant="outline"
              onPress={() => {
                logout();
                router.replace('/(auth)/login');
              }}
              className="w-full"
            />
          </View>
        ) : (
          <>
            {/* Slot 1: Cédula Frente */}
            <TouchableOpacity
              onPress={() => setIdFrontSelected(!idFrontSelected)}
              className={`p-4 rounded-2xl border-2 border-dashed mb-3 flex-row items-center justify-between ${
                idFrontSelected ? 'border-success bg-emerald-50/50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <View>
                <Text className="text-sm font-bold text-slate-800">1. Cédula (Frente)</Text>
                <Text className="text-xs text-slate-500">Fotografía nítida del frente</Text>
              </View>
              <Text className="text-lg">{idFrontSelected ? '✅' : '📷'}</Text>
            </TouchableOpacity>

            {/* Slot 2: Cédula Reverso */}
            <TouchableOpacity
              onPress={() => setIdBackSelected(!idBackSelected)}
              className={`p-4 rounded-2xl border-2 border-dashed mb-3 flex-row items-center justify-between ${
                idBackSelected ? 'border-success bg-emerald-50/50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <View>
                <Text className="text-sm font-bold text-slate-800">2. Cédula (Reverso)</Text>
                <Text className="text-xs text-slate-500">Fotografía del código de barras</Text>
              </View>
              <Text className="text-lg">{idBackSelected ? '✅' : '📷'}</Text>
            </TouchableOpacity>

            {/* Slot 3: Selfie */}
            <TouchableOpacity
              onPress={() => setSelfieSelected(!selfieSelected)}
              className={`p-4 rounded-2xl border-2 border-dashed mb-3 flex-row items-center justify-between ${
                selfieSelected ? 'border-success bg-emerald-50/50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <View>
                <Text className="text-sm font-bold text-slate-800">3. Selfie con Documento</Text>
                <Text className="text-xs text-slate-500">Rostro visible sosteniendo tu cédula</Text>
              </View>
              <Text className="text-lg">{selfieSelected ? '✅' : '🤳'}</Text>
            </TouchableOpacity>

            {/* Slot 4: Tarjeta de Propiedad / SOAT */}
            <TouchableOpacity
              onPress={() => setVehicleDocSelected(!vehicleDocSelected)}
              className={`p-4 rounded-2xl border-2 border-dashed mb-6 flex-row items-center justify-between ${
                vehicleDocSelected ? 'border-success bg-emerald-50/50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <View>
                <Text className="text-sm font-bold text-slate-800">4. SOAT / Tarjeta de Propiedad</Text>
                <Text className="text-xs text-slate-500">Requerido para moto o auto</Text>
              </View>
              <Text className="text-lg">{vehicleDocSelected ? '✅' : '📄'}</Text>
            </TouchableOpacity>

            <Button
              title="Enviar Documentos a Revisión"
              onPress={handleSubmit}
              className="w-full mb-4"
            />

            <Button
              title="Cerrar Sesión"
              variant="outline"
              onPress={() => {
                logout();
                router.replace('/(auth)/login');
              }}
              className="w-full"
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
