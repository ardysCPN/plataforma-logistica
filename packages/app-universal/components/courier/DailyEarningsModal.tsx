import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { UniversalBottomSheet } from '../common/UniversalBottomSheet';
import { api } from '../../services/api';

interface DailyEarningsModalProps {
  visible: boolean;
  onClose: () => void;
  walletBalance?: number;
}

type PeriodFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

interface HistoryOrderItem {
  id: string;
  serviceType: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  price: number;
  commissionAmount: number;
  createdAt: string;
  completedAt?: string;
  counterpartName: string;
}

export const DailyEarningsModal: React.FC<DailyEarningsModalProps> = ({
  visible,
  onClose,
  walletBalance = 0,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('TODAY');
  const [orders, setOrders] = useState<HistoryOrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchHistory();
    }
  }, [visible]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get<HistoryOrderItem[]>('/api/orders/history');
      if (Array.isArray(res.data)) {
        setOrders(res.data.filter((o) => o.status === 'COMPLETED'));
      }
    } catch (err) {
      console.warn('Error cargando historial de ganancias:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de servicios según el período seleccionado
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Inicio de la semana actual (Lunes)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).getTime();

    // Inicio del mes actual
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter((o) => {
      const orderDate = new Date(o.completedAt || o.createdAt).getTime();
      switch (period) {
        case 'TODAY':
          return orderDate >= startOfToday;
        case 'WEEK':
          return orderDate >= startOfWeek;
        case 'MONTH':
          return orderDate >= startOfMonth;
        case 'ALL':
        default:
          return true;
      }
    });
  }, [orders, period]);

  // Cálculos consolidados del cuadre de caja
  const metrics = useMemo(() => {
    const totalGross = filteredOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const totalCommission = filteredOrders.reduce((sum, o) => sum + (Number(o.commissionAmount) || 0), 0);
    const totalNet = Math.max(0, totalGross - totalCommission);
    const tripsCount = filteredOrders.length;
    const avgNetPerTrip = tripsCount > 0 ? Math.round(totalNet / tripsCount) : 0;

    return {
      totalGross,
      totalCommission,
      totalNet,
      tripsCount,
      avgNetPerTrip,
    };
  }, [filteredOrders]);

  const getPeriodLabel = () => {
    switch (period) {
      case 'TODAY':
        return 'Hoy';
      case 'WEEK':
        return 'Esta Semana';
      case 'MONTH':
        return 'Este Mes';
      case 'ALL':
        return 'Todo el Historial';
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'DELIVERY':
        return '📦';
      case 'ERRAND':
        return '🛒';
      default:
        return '🛵';
    }
  };

  return (
    <UniversalBottomSheet visible={visible} onClose={onClose} height="88%" maxHeight="94%">
      <View className="flex-1 bg-slate-50 flex-col">
        {/* Encabezado */}
        <View className="bg-secondary px-5 py-4 flex-row items-center justify-between border-b border-slate-700">
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xl">📊</Text>
              <Text className="text-lg font-black text-white tracking-tight">
                Cuadre de Caja & Ganancias
              </Text>
            </View>
            <Text className="text-xs text-slate-300 mt-0.5">
              Consolidación de servicios • Conductor DOMY
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-white/10 items-center justify-center active:bg-white/20"
          >
            <Text className="text-white font-bold">✕</Text>
          </TouchableOpacity>
        </View>

        {/* Selector de Rango de Fechas */}
        <View className="bg-white px-4 py-3 border-b border-slate-200">
          <View className="flex-row items-center bg-slate-100 p-1 rounded-2xl">
            {(
              [
                { key: 'TODAY', label: 'Hoy' },
                { key: 'WEEK', label: 'Semana' },
                { key: 'MONTH', label: 'Mes' },
                { key: 'ALL', label: 'Todo' },
              ] as const
            ).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setPeriod(tab.key)}
                className={`flex-1 py-2 rounded-xl items-center justify-center transition-all ${
                  period === tab.key ? 'bg-primary shadow-sm' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    period === tab.key ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contenido Principal con Métricas y Lista */}
        <ScrollView
          className="flex-1 p-4"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {loading ? (
            <View className="py-16 items-center justify-center">
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text className="text-xs text-slate-500 mt-3 font-semibold">
                Calculando consolidado de caja...
              </Text>
            </View>
          ) : (
            <>
              {/* Tarjeta Hero: Ganancia Neta en Bolsillo */}
              <View className="bg-gradient-to-br from-emerald-600 to-teal-700 bg-emerald-600 rounded-3xl p-5 mb-4 shadow-lg border border-emerald-500/50">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs font-black text-emerald-100 uppercase tracking-wider">
                      Ganancia Neta en Bolsillo
                    </Text>
                  </View>
                  <View className="bg-white/20 px-2.5 py-0.5 rounded-full">
                    <Text className="text-[11px] font-bold text-white">
                      {getPeriodLabel()}
                    </Text>
                  </View>
                </View>

                <Text className="text-3xl font-black text-white tracking-tight my-1">
                  ${metrics.totalNet.toLocaleString('es-CO')} COP
                </Text>

                <View className="flex-row items-center justify-between pt-2 mt-2 border-t border-white/20">
                  <Text className="text-xs text-emerald-100">
                    {metrics.tripsCount} {metrics.tripsCount === 1 ? 'viaje realizado' : 'viajes realizados'}
                  </Text>
                  <Text className="text-xs font-bold text-white">
                    Promedio: ${metrics.avgNetPerTrip.toLocaleString('es-CO')} / viaje
                  </Text>
                </View>
              </View>

              {/* Tarjetas de Desglose de Caja */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <Text className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Facturación Bruta
                  </Text>
                  <Text className="text-lg font-black text-slate-900">
                    ${metrics.totalGross.toLocaleString('es-CO')}
                  </Text>
                  <Text className="text-[10px] text-slate-400 mt-0.5">
                    Cobrado a clientes
                  </Text>
                </View>

                <View className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <Text className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1">
                    Comisión DOMY
                  </Text>
                  <Text className="text-lg font-black text-rose-600">
                    -${metrics.totalCommission.toLocaleString('es-CO')}
                  </Text>
                  <Text className="text-[10px] text-slate-400 mt-0.5">
                    10% de plataforma
                  </Text>
                </View>
              </View>

              {/* Tarjeta de Billetera Actual */}
              <View className="bg-slate-900 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary/20 items-center justify-center">
                    <Text className="text-xl">💳</Text>
                  </View>
                  <View>
                    <Text className="text-[11px] text-slate-400 font-bold uppercase">
                      Saldo en Billetera Prepago
                    </Text>
                    <Text className="text-base font-black text-white">
                      ${Number(walletBalance || 0).toLocaleString('es-CO')} COP
                    </Text>
                  </View>
                </View>
                <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/40">
                  <Text className="text-[11px] font-black text-emerald-400">
                    ● Al día
                  </Text>
                </View>
              </View>

              {/* Título de la Lista de Servicios */}
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm font-black text-slate-900">
                  Detalle de Servicios ({filteredOrders.length})
                </Text>
                <TouchableOpacity
                  onPress={fetchHistory}
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  <Text className="text-xs text-primary font-bold">↻ Actualizar</Text>
                </TouchableOpacity>
              </View>

              {/* Lista Detallada de Viajes */}
              {filteredOrders.length === 0 ? (
                <View className="bg-white border border-slate-200 rounded-3xl p-8 items-center text-center shadow-sm">
                  <Text className="text-3xl mb-2">🛵</Text>
                  <Text className="text-sm font-bold text-slate-800 text-center mb-1">
                    No hay servicios registrados en este período
                  </Text>
                  <Text className="text-xs text-slate-400 text-center leading-relaxed">
                    Los viajes completados en {getPeriodLabel().toLowerCase()} aparecerán aquí con su valor neto de ganancia.
                  </Text>
                </View>
              ) : (
                filteredOrders.map((order, idx) => {
                  const netEarn = Math.max(0, (Number(order.price) || 0) - (Number(order.commissionAmount) || 0));
                  const dateStr = new Date(order.completedAt || order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View
                      key={order.id || `earn_${idx}`}
                      className="bg-white border border-slate-200 rounded-2xl p-4 mb-2.5 shadow-sm"
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-2">
                          <View className="w-7 h-7 rounded-full bg-slate-100 items-center justify-center">
                            <Text className="text-sm">{getServiceIcon(order.serviceType)}</Text>
                          </View>
                          <View>
                            <Text className="text-xs font-black text-slate-800">
                              {order.serviceType}
                            </Text>
                            <Text className="text-[10px] text-slate-400">
                              {dateStr} • {order.counterpartName || 'Cliente'}
                            </Text>
                          </View>
                        </View>

                        <View className="items-end">
                          <Text className="text-sm font-black text-emerald-600">
                            +${netEarn.toLocaleString('es-CO')}
                          </Text>
                          <Text className="text-[10px] text-slate-400">
                            Bruto: ${Number(order.price || 0).toLocaleString('es-CO')}
                          </Text>
                        </View>
                      </View>

                      {/* Recorrido */}
                      <View className="bg-slate-50 rounded-xl p-2.5 mt-1 border border-slate-100">
                        <Text className="text-[11px] text-slate-600" numberOfLines={1}>
                          <Text className="font-bold text-slate-800">De: </Text>
                          {order.originAddress}
                        </Text>
                        <Text className="text-[11px] text-slate-600 mt-0.5" numberOfLines={1}>
                          <Text className="font-bold text-slate-800">A: </Text>
                          {order.destinationAddress}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="p-4 bg-white border-t border-slate-200">
          <TouchableOpacity
            onPress={onClose}
            className="w-full py-3.5 rounded-2xl bg-secondary items-center justify-center active:bg-slate-800 shadow-md"
          >
            <Text className="text-sm font-black text-white">Listo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </UniversalBottomSheet>
  );
};
