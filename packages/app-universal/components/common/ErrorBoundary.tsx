import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado de ejecución',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó una excepción:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-slate-900 justify-center items-center p-6">
          <View className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/40 items-center justify-center mb-5 shadow-lg">
            <Text className="text-4xl">🛠️</Text>
          </View>

          <Text className="text-2xl font-black text-white text-center mb-2 tracking-tight">
            Algo no salió como esperábamos
          </Text>

          <Text className="text-sm text-slate-300 text-center leading-relaxed mb-6 max-w-sm">
            Tus datos y cuentas se encuentran a salvo. Si tu teléfono tiene muchas aplicaciones abiertas o poca memoria disponible, te recomendamos cerrarlas para que DOMY funcione con máxima fluidez.
          </Text>

          {this.state.errorMessage ? (
            <View className="w-full max-w-sm bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 mb-6">
              <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Detalle del sistema:
              </Text>
              <Text className="text-xs text-slate-300 font-mono" numberOfLines={3}>
                {this.state.errorMessage}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={this.handleRestart}
            activeOpacity={0.85}
            className="w-full max-w-sm bg-primary py-4 rounded-2xl items-center justify-center shadow-lg active:bg-primary-dark flex-row gap-2"
          >
            <Text className="text-white text-lg font-bold">🔄</Text>
            <Text className="text-white text-base font-black">
              Reiniciar Pantalla
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
