import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { TopupRequest } from '@plataforma/shared';

interface PendingCourier {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  vehicleType: string;
  vehiclePlate?: string;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  selfieUrl: string;
  vehicleDocUrl?: string;
  createdAt: string;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'KYC' | 'TOPUPS' | 'PQR'>('KYC');
  const [pendingCouriers, setPendingCouriers] = useState<PendingCourier[]>([]);
  const [pendingTopups, setPendingTopups] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kycRes, topupsRes] = await Promise.all([
        api.get<PendingCourier[]>('/api/kyc/pending').catch(() => ({ data: [] })),
        api.get<TopupRequest[]>('/api/wallet/pending').catch(() => ({ data: [] })),
      ]);
      setPendingCouriers(kycRes.data);
      setPendingTopups(topupsRes.data);
    } catch {
      // Ignorar
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Aprobar o rechazar KYC
  const handleReviewKyc = async (userId: string, approve: boolean) => {
    try {
      await api.post('/api/kyc/review', {
        userId,
        approve,
        reason: approve ? undefined : 'Documentación ilegible o no válida',
      });
      Alert.alert(approve ? 'Conductor Aprobado' : 'Conductor Rechazado');
      setPendingCouriers((prev) => prev.filter((c) => c.id !== userId));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al procesar KYC');
    }
  };

  // Aprobar o rechazar Recarga Nequi/DaviPlata en 1 clic
  const handleReviewTopup = async (topupId: string, approved: boolean) => {
    try {
      const res = await api.post('/api/wallet/review', {
        topupId,
        approved,
        rejectionReason: approved ? undefined : 'Comprobante no coincide o ya utilizado',
      });
      Alert.alert(res.data.message);
      setPendingTopups((prev) => prev.filter((t) => t.id !== topupId));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al procesar recarga');
    }
  };

  return (
    <View className="flex-1 bg-slate-100 flex-row">
      {/* Barra Lateral del Dashboard (Desktop / Web) */}
      <View className="w-64 bg-secondary p-6 justify-between hidden md:flex">
        <View>
          <View className="flex-row items-center gap-2 mb-8">
            <View className="w-9 h-9 bg-primary rounded-xl items-center justify-center">
              <Text className="text-white font-black text-lg">⚡</Text>
            </View>
            <Text className="text-white font-extrabold text-lg">Admin Console</Text>
          </View>

          <View className="gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab('KYC')}
              className={`px-4 py-3 rounded-xl flex-row items-center justify-between ${
                activeTab === 'KYC' ? 'bg-primary text-white' : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-bold text-sm ${
                  activeTab === 'KYC' ? 'text-white' : 'text-slate-400'
                }`}
              >
                🪪 Aprobación KYC
              </Text>
              {pendingCouriers.length > 0 && (
                <View className="bg-white/20 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-bold">
                    {pendingCouriers.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('TOPUPS')}
              className={`px-4 py-3 rounded-xl flex-row items-center justify-between ${
                activeTab === 'TOPUPS' ? 'bg-primary text-white' : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-bold text-sm ${
                  activeTab === 'TOPUPS' ? 'text-white' : 'text-slate-400'
                }`}
              >
                💰 Recargas Nequi
              </Text>
              {pendingTopups.length > 0 && (
                <View className="bg-white/20 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-bold">
                    {pendingTopups.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('PQR')}
              className={`px-4 py-3 rounded-xl flex-row items-center justify-between ${
                activeTab === 'PQR' ? 'bg-primary text-white' : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-bold text-sm ${
                  activeTab === 'PQR' ? 'text-white' : 'text-slate-400'
                }`}
              >
                ⚠️ PQR & Disputas
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text className="text-slate-400 text-xs mb-3">Sesión: {user?.fullName}</Text>
          <Button
            title="Cerrar Sesión"
            variant="outline"
            onPress={() => {
              logout();
              router.replace('/(auth)/login');
            }}
            className="w-full border-slate-600"
          />
        </View>
      </View>

      {/* Área de Contenido Principal */}
      <ScrollView className="flex-1 p-6 md:p-10">
        {/* Cabecera Superior en Móvil / Responsive */}
        <View className="flex-row items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <View>
            <Text className="text-2xl md:text-3xl font-extrabold text-slate-900">
              {activeTab === 'KYC'
                ? 'Validación de Conductores KYC'
                : activeTab === 'TOPUPS'
                ? 'Validación de Recargas Nequi / DaviPlata'
                : 'Mesa de Ayuda y PQR'}
            </Text>
            <Text className="text-xs md:text-sm text-slate-500 mt-1">
              Operaciones en tiempo real para la plataforma universal
            </Text>
          </View>

          <Button
            title="🔄 Actualizar"
            variant="outline"
            onPress={fetchData}
            loading={loading}
            className="py-2 px-4"
          />
        </View>

        {/* Pestañas para Móvil */}
        <View className="flex-row gap-2 mb-6 md:hidden">
          {(['KYC', 'TOPUPS', 'PQR'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl items-center ${
                activeTab === tab ? 'bg-primary' : 'bg-white border border-slate-200'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === tab ? 'text-white' : 'text-slate-700'
                }`}
              >
                {tab === 'KYC' ? 'KYC' : tab === 'TOPUPS' ? 'Recargas' : 'PQR'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab 1: KYC Conductores */}
        {activeTab === 'KYC' && (
          <View>
            {pendingCouriers.length === 0 ? (
              <View className="bg-white rounded-3xl p-12 items-center border border-slate-200 shadow-sm">
                <Text className="text-4xl mb-3">✅</Text>
                <Text className="text-base font-bold text-slate-800">
                  No hay conductores pendientes de aprobación
                </Text>
                <Text className="text-xs text-slate-400 mt-1">
                  Todos los registros KYC han sido procesados.
                </Text>
              </View>
            ) : (
              <View className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingCouriers.map((c) => (
                  <View
                    key={c.id}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-4"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View>
                        <Text className="text-lg font-bold text-slate-900">{c.fullName}</Text>
                        <Text className="text-xs text-slate-500">
                          📞 {c.phone} • {c.vehicleType} {c.vehiclePlate ? `(${c.vehiclePlate})` : ''}
                        </Text>
                      </View>
                      <View className="bg-amber-100 px-3 py-1 rounded-full">
                        <Text className="text-amber-800 text-[11px] font-bold">PENDIENTE</Text>
                      </View>
                    </View>

                    <Text className="text-xs text-slate-400 mb-4">
                      Registrado: {new Date(c.createdAt).toLocaleDateString()}
                    </Text>

                    <View className="flex-row gap-3">
                      <Button
                        title="Rechazar"
                        variant="outline"
                        onPress={() => handleReviewKyc(c.id, false)}
                        className="flex-1 py-2.5 text-danger border-red-200"
                      />
                      <Button
                        title="Aprobar en 1 Clic ✓"
                        variant="primary"
                        onPress={() => handleReviewKyc(c.id, true)}
                        className="flex-1 py-2.5"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab 2: Recargas de Billetera Nequi/DaviPlata */}
        {activeTab === 'TOPUPS' && (
          <View>
            {pendingTopups.length === 0 ? (
              <View className="bg-white rounded-3xl p-12 items-center border border-slate-200 shadow-sm">
                <Text className="text-4xl mb-3">💰</Text>
                <Text className="text-base font-bold text-slate-800">
                  No hay solicitudes de recarga pendientes
                </Text>
                <Text className="text-xs text-slate-400 mt-1">
                  Todas las recargas reportadas han sido aprobadas o liquidadas.
                </Text>
              </View>
            ) : (
              <View className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingTopups.map((t) => (
                  <View
                    key={t.id}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-4"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xl font-black text-emerald-600">
                        +${t.amount.toLocaleString()} COP
                      </Text>
                      <View className="bg-slate-100 px-3 py-1 rounded-full">
                        <Text className="text-slate-800 text-xs font-bold">{t.paymentMethod}</Text>
                      </View>
                    </View>

                    <Text className="text-sm font-semibold text-slate-800 mb-1">
                      Conductor: {t.courierName || 'Conductor'} ({t.courierPhone || ''})
                    </Text>
                    <Text className="text-xs text-slate-500 mb-2">
                      Número de Aprobación: <Text className="font-mono font-bold text-slate-800">{t.referenceNumber}</Text>
                    </Text>

                    {t.voucherUrl && (
                      <Text className="text-xs text-primary underline mb-4">
                        Ver Comprobante: {t.voucherUrl}
                      </Text>
                    )}

                    <View className="flex-row gap-3">
                      <Button
                        title="Rechazar"
                        variant="outline"
                        onPress={() => handleReviewTopup(t.id, false)}
                        className="flex-1 py-2.5 text-danger border-red-200"
                      />
                      <Button
                        title="Aprobar Saldo (1 Clic) ✓"
                        variant="primary"
                        onPress={() => handleReviewTopup(t.id, true)}
                        className="flex-1 py-2.5"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab 3: PQR */}
        {activeTab === 'PQR' && (
          <View className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <Text className="text-base font-bold text-slate-900 mb-2">
              Consola de Trazabilidad y Resolución de Incidentes
            </Text>
            <Text className="text-xs text-slate-500 leading-relaxed mb-6">
              Esta sección permite consultar la traza GPS histórica guardada del servicio, el chat auditado de la orden y los tiempos de entrega para resolver disputas de tarifas o paquetes no entregados.
            </Text>
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-6 items-center">
              <Text className="text-slate-400 text-xs">Sin incidentes abiertos en este momento.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
