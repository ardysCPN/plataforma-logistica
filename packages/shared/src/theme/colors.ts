/**
 * Paleta de Colores Oficial del Sistema de Diseño Unificado
 * Especificada en agent.md - Sección 4.1
 */

export const colors = {
  // Brand Action (Ámbar / Naranja Intenso)
  primary: {
    DEFAULT: '#FF6B00',
    hover: '#E66000',
    light: '#FFF7ED',
    dark: '#C2410C',
  },

  // Deep Slate (Azul Oscuro Corporativo)
  secondary: {
    DEFAULT: '#0F172A',
    surface: '#1E293B',
    border: '#334155',
    light: '#64748B',
  },

  // Accent / Route Corridor (Cian Geoespacial)
  accent: {
    DEFAULT: '#06B6D4',
    fill: 'rgba(6, 182, 212, 0.20)',
    light: '#E0F2FE',
  },

  // Success (Verde Esmeralda)
  success: {
    DEFAULT: '#10B981',
    surface: '#ECFDF5',
    dark: '#047857',
  },

  // Warning (Amarillo Ámbar Alerta)
  warning: {
    DEFAULT: '#F59E0B',
    surface: '#FFFBEB',
    dark: '#B45309',
  },

  // Danger (Rojo Carmesí / SOS)
  danger: {
    DEFAULT: '#EF4444',
    surface: '#FEF2F2',
    dark: '#B91C1C',
  },

  // Fondos y Neutros
  neutrals: {
    light: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      border: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
    },
    dark: {
      background: '#090D16',
      card: '#1E293B',
      border: '#334155',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  },
} as const;

export type ColorsTheme = typeof colors;
