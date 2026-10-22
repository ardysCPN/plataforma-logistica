import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { UniversalDialog } from './UniversalDialog';
import { Button } from './Button';

interface LegalModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  return (
    <UniversalDialog
      visible={visible}
      onClose={onDecline}
      maxWidth={480}
    >
      <View className="w-full">
        <Text className="text-xl font-bold text-slate-900 mb-2">
          Descargo de Responsabilidad y Términos Legales
        </Text>
        <Text className="text-xs text-primary font-semibold mb-4">
          VERSIÓN 1.0 — ACEPTACIÓN EXPRESA OBLIGATORIA
        </Text>

        <ScrollView className="mb-6 pr-2 max-h-72" keyboardShouldPersistTaps="handled">
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4">
            <Text className="text-amber-900 text-xs font-semibold leading-relaxed">
              Cláusula Esencial: La plataforma actúa exclusivamente como portal de contacto y tecnología. El contrato de transporte o mandato se celebra de forma directa e independiente entre el usuario solicitante y el conductor independiente.
            </Text>
          </View>

          <Text className="text-slate-700 text-sm leading-relaxed mb-3">
            1. <Text className="font-semibold">Naturaleza del Servicio:</Text> Esta aplicación no es una empresa de transporte ni de mensajería, ni suministra los bienes solicitados en los mandados. Proporciona una herramienta digital para facilitar la coordinación, subasta de tarifas y seguimiento entre partes independientes.
          </Text>

          <Text className="text-slate-700 text-sm leading-relaxed mb-3">
            2. <Text className="font-semibold">Pagos y Tarifas:</Text> Las tarifas son acordadas libremente entre cliente y conductor. La plataforma no custodia pagos de clientes ni realiza intermediación financiera directa en esta versión.
          </Text>

          <Text className="text-slate-700 text-sm leading-relaxed mb-3">
            3. <Text className="font-semibold">Tratamiento de Datos y Geolocalización:</Text> Para la seguridad del servicio, la app registra coordenadas GPS durante los viajes activos y audita la dirección IP y firma del dispositivo al aceptar estos términos.
          </Text>
        </ScrollView>

        <View className="flex-row gap-3">
          <Button
            title="Rechazar"
            variant="outline"
            onPress={onDecline}
            className="flex-1"
          />
          <Button
            title="Acepto los Términos"
            variant="primary"
            onPress={onAccept}
            className="flex-1"
          />
        </View>
      </View>
    </UniversalDialog>
  );
};
