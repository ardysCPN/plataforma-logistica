import { useAuthStore } from '../stores/authStore';

describe('App Universal - AuthStore Suite', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('debe inicializarse con usuario nulo y sin token', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('debe limpiar la sesión al invocar logout()', () => {
    useAuthStore.setState({
      user: {
        id: '123',
        fullName: 'Test User',
        phone: '3001234567',
        role: 'CLIENT',
        status: 'ACTIVE',
        ratingAvg: 5.0,
        ratingCount: 0,
        walletBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      token: 'mock_token',
    });

    expect(useAuthStore.getState().token).toBe('mock_token');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
