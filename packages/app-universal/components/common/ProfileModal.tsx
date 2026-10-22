import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { Button } from './Button';
import { UniversalBottomSheet } from './UniversalBottomSheet';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose }) => {
  const { user, courierProfile, updateAvatar, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [vehicleModel, setVehicleModel] = useState(courierProfile?.vehicleModel || '');
  const [vehicleColor, setVehicleColor] = useState(courierProfile?.vehicleColor || '');
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sincronizar datos al abrir
  React.useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setVehicleModel(courierProfile?.vehicleModel || '');
      setVehicleColor(courierProfile?.vehicleColor || '');
    }
  }, [visible, user, courierProfile]);

  const handlePickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para cambiar tu foto de perfil.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLoadingAvatar(true);

        let dataUri = '';
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          dataUri = `data:${mime};base64,${asset.base64}`;
        } else if (asset.uri) {
          dataUri = asset.uri;
        }

        if (dataUri) {
          await updateAvatar(dataUri);
          if (Platform.OS === 'web') alert('Foto de perfil actualizada correctamente.');
          else Alert.alert('Éxito', 'Foto de perfil actualizada correctamente.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar la foto';
      if (Platform.OS === 'web') alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
    } finally {
      setLoadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'El nombre no puede estar vacío');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        vehicleModel: vehicleModel.trim() || undefined,
        vehicleColor: vehicleColor.trim() || undefined,
      });
      if (Platform.OS === 'web') alert('Perfil guardado exitosamente.');
      else Alert.alert('Éxito', 'Perfil guardado exitosamente.');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar el perfil';
      if (Platform.OS === 'web') alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const isCourier = user?.role === 'COURIER';

  return (
    <UniversalBottomSheet visible={visible} onClose={onClose} maxHeight="90%">
      <View className="p-6">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View>
              <Text className="text-xl font-black text-slate-900">👤 Mi Perfil</Text>
              <Text className="text-xs text-slate-500">Gestiona tu identidad y datos del servicio</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 bg-slate-100 rounded-full items-center justify-center active:bg-slate-200"
            >
              <Text className="text-slate-600 font-bold text-base">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
            {/* Foto de Perfil */}
            <View className="items-center justify-center py-2">
              <View className="relative">
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    className="w-24 h-24 rounded-full border-4 border-primary"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-24 h-24 rounded-full bg-slate-800 border-4 border-primary items-center justify-center">
                    <Text className="text-3xl font-black text-white">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {loadingAvatar && (
                  <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                    <ActivityIndicator color="#ffffff" />
                  </View>
                )}

                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={loadingAvatar}
                  className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-2 border-white shadow-md active:opacity-80"
                >
                  <Text className="text-white text-xs">📷</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handlePickImage} className="mt-2">
                <Text className="text-primary font-bold text-xs">
                  {loadingAvatar ? 'Subiendo imagen...' : 'Cambiar Foto de Perfil'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Badges de rol y estado */}
            <View className="flex-row items-center justify-center gap-2 mb-2">
              <View className="bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                <Text className="text-[11px] font-bold text-orange-800">
                  {isCourier ? '🛵 Conductor Domy' : '👤 Cliente'}
                </Text>
              </View>
              {isCourier && (
                <View className="bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                  <Text className="text-[11px] font-bold text-emerald-800">
                    ⭐ {(courierProfile?.rating || 5.0).toFixed(1)} ({courierProfile?.completedOrders || 0} viajes)
                  </Text>
                </View>
              )}
            </View>

            {/* Formulario */}
            <View className="space-y-3">
              <View>
                <Text className="text-xs font-bold text-slate-600 mb-1">Nombre Completo</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre completo"
                  placeholderTextColor="#94a3b8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-medium"
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-slate-600 mb-1">Correo Electrónico</Text>
                <TextInput
                  value={user?.email || ''}
                  editable={false}
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 font-medium"
                />
              </View>

              <View>
                <Text className="text-xs font-bold text-slate-600 mb-1">Teléfono</Text>
                <TextInput
                  value={user?.phone || 'No registrado'}
                  editable={false}
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 font-medium"
                />
              </View>

              {/* Datos de Conductor */}
              {isCourier && (
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-2 space-y-3">
                  <Text className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    🛵 Información del Vehículo
                  </Text>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-[11px] font-bold text-slate-500 mb-1">Tipo</Text>
                      <TextInput
                        value={courierProfile?.vehicleType || 'MOTO'}
                        editable={false}
                        className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 text-xs font-bold"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] font-bold text-slate-500 mb-1">Placa</Text>
                      <TextInput
                        value={courierProfile?.vehiclePlate || 'N/A'}
                        editable={false}
                        className="bg-amber-100 border border-amber-300 rounded-xl px-3 py-2 text-amber-900 text-xs font-black tracking-widest text-center"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-[11px] font-bold text-slate-600 mb-1">Modelo de Vehículo (Marca / Línea)</Text>
                    <TextInput
                      value={vehicleModel}
                      onChangeText={setVehicleModel}
                      placeholder="Ej: Chevrolet Spark GT / Yamaha NMax"
                      placeholderTextColor="#94a3b8"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-medium"
                    />
                  </View>

                  <View>
                    <Text className="text-[11px] font-bold text-slate-600 mb-1">Color del Vehículo</Text>
                    <TextInput
                      value={vehicleColor}
                      onChangeText={setVehicleColor}
                      placeholder="Ej: Rojo metalizado / Negro"
                      placeholderTextColor="#94a3b8"
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-medium"
                    />
                  </View>
                </View>
              )}
            </View>

            <View className="pt-4 pb-2">
              <Button
                title="Guardar Cambios"
                onPress={handleSaveProfile}
                loading={saving}
                className="w-full"
              />
            </View>
          </ScrollView>
      </View>
    </UniversalBottomSheet>
  );
};
