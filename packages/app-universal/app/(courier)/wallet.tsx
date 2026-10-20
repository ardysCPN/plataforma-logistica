import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { PaymentMethod, WalletTransaction } from '@plataforma/shared';

export default function CourierWalletScreen() {
  const router = useRouter();
  const { user, loadProfile } = useAuthStore();

  const [balance, setBalance] = useState(user?.walletBalance || 0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState('20000');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('NEQUI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [voucherUrl, setVoucherUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTopupForm, setShowTopupForm] = useState(false);

  const fetchWallet = async () => {
    try {
      const res = await api.get<{ balance: number; transactions: WalletTransaction[] }>(
        '/api/wallet/my-wallet'
      );
      setBalance(res.data.balance);
      setTransactions(res.data.transactions);
      await loadProfile();
    } catch {
      // Ignorar
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleRequestTopup = async () => {
    if (!amount || !referenceNumber || !voucherUrl) {
      Alert.alert('Campos requeridos', 'Ingresa el monto, número de comprobante y enlace del comprobante');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/wallet/topup-request', {
        amount: Number(amount),
        paymentMethod,
        referenceNumber,
        voucherUrl,
      });

      Alert.alert(
        '¡Solicitud Enviada!',
        'El administrador validará tu comprobante y el saldo se acreditará en tu cuenta en breve.'
      );
      setShowTopupForm(false);
      setReferenceNumber('');
      setVoucherUrl('');
      fetchWallet();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Cabecera */}
      <View className="bg-secondary px-5 py-4 pt-12 flex-row items-center justify-between shadow-md">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Text className="text-white text-base">← Volver</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Mi Billetera Prepago</Text>
        <View className="w-12" />
      </View>

      <View className="p-5">
        {/* Tarjeta de Saldo */}
        <View className="bg-slate-900 rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden">
          <View className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/20 rounded-full" />
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Saldo Disponible para Comisiones
          </Text>
          <Text className="text-4xl font-extrabold text-white mb-4">
            ${balance.toLocaleString()} COP
          </Text>

          <View className="flex-row items-center gap-2 mb-4">
            <View
              className={`w-2.5 h-2.5 rounded-full ${
                balance > 0 ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'
              }`}
            />
            <Text className="text-xs text-slate-300 font-medium">
              {balance > 0 ? 'Cuenta habilitada para recibir ofertas' : 'Saldo agotado. Recarga para seguir recibiendo pedidos.'}
            </Text>
          </View>

          <Button
            title="+ Recargar Saldo"
            variant="primary"
            onPress={() => setShowTopupForm(!showTopupForm)}
          />
        </View>

        {/* Formulario de Recarga */}
        {showTopupForm && (
          <View className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-6">
            <Text className="text-lg font-bold text-slate-900 mb-1">
              Reportar Recarga de Saldo
            </Text>
            <Text className="text-xs text-slate-500 mb-4 leading-relaxed">
              Transfiere a nuestras cuentas oficiales Nequi/DaviPlata (300 000 0000) y registra los datos del comprobante aquí.
            </Text>

            {/* Selector de Medio */}
            <View className="flex-row gap-2 mb-4">
              {(['NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_QR'] as PaymentMethod[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-xl border items-center ${
                    paymentMethod === m
                      ? 'border-primary bg-primary/10'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      paymentMethod === m ? 'text-primary' : 'text-slate-600'
                    }`}
                  >
                    {m === 'BANCOLOMBIA_QR' ? 'Bancolombia' : m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Monto Pagado ($ COP) *"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Input
              label="Número de Aprobación / Referencia *"
              placeholder="Ej. M12345678"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
            />

            <Input
              label="Enlace / Foto del Comprobante *"
              placeholder="Ej. https://comprobantes.com/foto1.png"
              value={voucherUrl}
              onChangeText={setVoucherUrl}
            />

            <Button
              title="Enviar Comprobante a Validación"
              variant="primary"
              onPress={handleRequestTopup}
              loading={loading}
              className="mt-2"
            />
          </View>
        )}

        {/* Historial de Movimientos */}
        <Text className="text-base font-extrabold text-slate-900 mb-3">
          Historial de Movimientos
        </Text>

        {transactions.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-2xl p-6 items-center">
            <Text className="text-xs text-slate-400">Aún no tienes movimientos registrados.</Text>
          </View>
        ) : (
          transactions.map((tx) => (
            <View
              key={tx.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 mb-2 flex-row items-center justify-between"
            >
              <View>
                <Text className="text-sm font-bold text-slate-900">
                  {tx.txType === 'TOPUP_CREDIT'
                    ? 'Recarga Acreditada'
                    : tx.txType === 'COMMISSION_DEDUCTION'
                    ? 'Comisión por Entrega (10%)'
                    : 'Ajuste Contable'}
                </Text>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {tx.notes ? (
                  <Text className="text-[11px] text-slate-500 mt-0.5">{tx.notes}</Text>
                ) : null}
              </View>

              <Text
                className={`text-base font-black ${
                  tx.txType === 'TOPUP_CREDIT' ? 'text-emerald-600' : 'text-slate-800'
                }`}
              >
                {tx.txType === 'TOPUP_CREDIT' ? '+' : '-'}${tx.amount} COP
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
