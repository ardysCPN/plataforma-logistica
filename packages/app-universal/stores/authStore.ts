import { create } from 'zustand';
import { User, CourierProfile, LoginInput, RegisterClientInput, RegisterCourierInput } from '@plataforma/shared';
import { api, setAuthToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface AuthState {
  user: User | null;
  courierProfile: CourierProfile | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

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
  error: null,

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: User; token: string }>('/api/auth/login', input);
      const { user, token } = res.data;
      setAuthToken(token);
      connectSocket(token);

      set({ user, token, isLoading: false });
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
      set({ user, token, isLoading: false });
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
      set({ user, token, isLoading: false });
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
    } catch {
      // Ignorar error si no está autenticado
    }
  },

  logout: () => {
    setAuthToken(null);
    disconnectSocket();
    set({ user: null, courierProfile: null, token: null });
  },

  clearError: () => set({ error: null }),
}));
