import { Platform } from 'react-native';

const memoryStore: Record<string, string> = {};

export const appStorage = {
  getItem(key: string): string | null {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memoryStore[key] || null;
      }
    }
    return memoryStore[key] || null;
  },

  setItem(key: string, value: string): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Fallback memoria si almacenamiento está bloqueado
      }
    }
    memoryStore[key] = value;
  },

  removeItem(key: string): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Fallback
      }
    }
    delete memoryStore[key];
  },

  getJSON<T>(key: string): T | null {
    const val = this.getItem(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  },

  setJSON(key: string, value: unknown): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Error guardando en appStorage:', e);
    }
  },
};
