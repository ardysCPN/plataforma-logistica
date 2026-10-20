import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { LegalModal } from '../../components/common/LegalModal';
import { useAuthStore } from '../../stores/authStore';
import { VehicleType, UserRole } from '@plataforma/shared';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerClient, registerCourier, isLoading, error, clearError } = useAuthStore();

  const [role, setRole] = useState<UserRole>('CLIENT');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTO');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !phone || !password) {
      Alert.alert('Campos incompletos', 'Por favor llena los campos requeridos');
      return;
    }

    if (!termsAccepted) {
      setShowLegalModal(true);
      return;
    }

    try {
      if (role === 'CLIENT') {
        await registerClient({
          fullName,
          phone,
          email: email || undefined,
          password,
          termsAccepted: true,
        });
        router.replace('/');
      } else {
        await registerCourier({
          fullName,
          phone,
          email: email || undefined,
          password,
          vehicleType,
          vehiclePlate: vehiclePlate || undefined,
          termsAccepted: true,
        });
        router.replace('/(auth)/kyc');
      }
    } catch {
      // El error ya se setea en el store
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-slate-50 px-6 py-10">
      <View className="w-full max-w-md self-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <Text className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Crear Cuenta
        </Text>
        <Text className="text-sm text-slate-500 mb-6">
          Elige tu perfil para registrarte
        </Text>

        {/* Selector de Rol */}
        <View className="flex-row bg-slate-100 p-1.5 rounded-2xl mb-6">
          <TouchableOpacity
            onPress={() => setRole('CLIENT')}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              role === 'CLIENT' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                role === 'CLIENT' ? 'text-primary' : 'text-slate-500'
              }`}
            >
              Soy Cliente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRole('COURIER')}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              role === 'COURIER' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                role === 'COURIER' ? 'text-primary' : 'text-slate-500'
              }`}
            >
              Soy Conductor
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <Text className="text-danger text-xs font-semibold">{error}</Text>
          </View>
        )}

        <Input
          label="Nombre Completo *"
          placeholder="Ej. Juan Pérez"
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            if (error) clearError();
          }}
        />

        <Input
          label="Número Celular *"
          placeholder="Ej. 3001234567"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            if (error) clearError();
          }}
        />

        <Input
          label="Correo Electrónico (Opcional)"
          placeholder="ejemplo@correo.com"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Input
          label="Contraseña *"
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) clearError();
          }}
        />

        {role === 'COURIER' && (
          <>
            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1.5">
                Tipo de Vehículo *
              </Text>
              <View className="flex-row gap-2">
                {(['MOTO', 'CAR', 'BICYCLE'] as VehicleType[]).map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setVehicleType(v)}
                    className={`flex-1 py-2 rounded-xl border items-center ${
                      vehicleType === v
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        vehicleType === v ? 'text-primary' : 'text-slate-600'
                      }`}
                    >
                      {v === 'MOTO' ? 'Moto' : v === 'CAR' ? 'Auto' : 'Bici'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {vehicleType !== 'BICYCLE' && (
              <Input
                label="Placa del Vehículo *"
                placeholder="Ej. XYZ123"
                autoCapitalize="characters"
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
              />
            )}
          </>
        )}

        {/* Checkbox Aceptación Legal */}
        <TouchableOpacity
          onPress={() => setShowLegalModal(true)}
          className="flex-row items-center gap-3 my-4 bg-slate-50 p-3 rounded-xl border border-slate-200"
        >
          <View
            className={`w-5 h-5 rounded-md border items-center justify-center ${
              termsAccepted ? 'bg-primary border-primary' : 'border-slate-400 bg-white'
            }`}
          >
            {termsAccepted && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="text-xs text-slate-700 flex-1 leading-relaxed">
            Acepto expresamente los{' '}
            <Text className="text-primary font-bold underline">
              Términos, Condiciones y Descargo Legal
            </Text>
          </Text>
        </TouchableOpacity>

        <Button
          title={role === 'COURIER' ? 'Continuar a KYC' : 'Completar Registro'}
          onPress={handleRegister}
          loading={isLoading}
          className="mt-2 mb-6"
        />

        <View className="flex-row justify-center items-center gap-1.5">
          <Text className="text-sm text-slate-500">¿Ya tienes cuenta?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-sm font-bold text-primary">Inicia Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LegalModal
        visible={showLegalModal}
        onAccept={() => {
          setTermsAccepted(true);
          setShowLegalModal(false);
        }}
        onDecline={() => {
          setTermsAccepted(false);
          setShowLegalModal(false);
        }}
      />
    </ScrollView>
  );
}
