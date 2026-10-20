import { create } from 'zustand';
import { User, CourierProfile, LoginInput, RegisterClientInput, RegisterCourierInput } from '@plataforma/shared';
import { api, setAuthToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { appStorage } from '../services/storage';

interface AuthState {
  user: User | null;
  courierProfile: CourierProfile | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  initializeAuth: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  registerClient: (input: RegisterClientInput) => Promise<void>;
  registerCourier: (input: RegisterCourierInput) => Promise<void>;
  loadProfile: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  courierProfile: null,
  token: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initializeAuth: async () => {
    try {
      const token = appStorage.getItem('auth_token');
      const user = appStorage.getJSON<User>('auth_user');
      const courierProfile = appStorage.getJSON<CourierProfile>('courier_profile');

      if (token && user) {
        setAuthToken(token);
        connectSocket(token);
        set({ token, user, courierProfile, isInitialized: true });
        // Refrescar perfil en segundo plano
        get().loadProfile().catch(() => {});
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: User; token: string }>('/api/auth/login', input);
      const { user, token } = res.data;
      setAuthToken(token);
      connectSocket(token);

      appStorage.setItem('auth_token', token);
      appStorage.setJSON('auth_user', user);

      set({ user, token, isLoading: false, isInitialized: true });
      if (user.role === 'COURIER') {
        await get().loadProfile();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  registerClient: async (input: RegisterClientInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: User; token: string }>('/api/auth/register/client', input);
      const { user, token } = res.data;
      setAuthToken(token);
      connectSocket(token);

      appStorage.setItem('auth_token', token);
      appStorage.setJSON('auth_user', user);

      set({ user, token, isLoading: false, isInitialized: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en el registro';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  registerCourier: async (input: RegisterCourierInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: User; token: string }>('/api/auth/register/courier', input);
      const { user, token } = res.data;
      setAuthToken(token);
      connectSocket(token);

      appStorage.setItem('auth_token', token);
      appStorage.setJSON('auth_user', user);

      set({ user, token, isLoading: false, isInitialized: true });
      await get().loadProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en el registro';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  loadProfile: async () => {
    try {
      const res = await api.get<{ user: User; profile: CourierProfile | null }>('/api/auth/me');
      set({ user: res.data.user, courierProfile: res.data.profile });
      appStorage.setJSON('auth_user', res.data.user);
      if (res.data.profile) {
        appStorage.setJSON('courier_profile', res.data.profile);
      }
    } catch {
      // Ignorar error si no está autenticado
    }
  },

  logout: () => {
    setAuthToken(null);
    disconnectSocket();
    appStorage.removeItem('auth_token');
    appStorage.removeItem('auth_user');
    appStorage.removeItem('courier_profile');
    set({ user: null, courierProfile: null, token: null });
  },

  clearError: () => set({ error: null }),
}));

