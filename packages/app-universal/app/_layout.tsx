import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { NetworkStatusBanner } from '../components/common/NetworkStatusBanner';
import '../global.css';

export default function RootLayout() {
  useEffect(() => {
    useAuthStore.getState().initializeAuth();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NetworkStatusBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(client)" options={{ headerShown: false }} />
          <Stack.Screen name="(courier)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="track/[orderId]" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
