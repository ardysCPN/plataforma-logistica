/**
 * Servicio de Internacionalización (i18n) para DOMY
 * Idioma predeterminado: Español ('es')
 * Detección automática del idioma del dispositivo (Android, iOS y Web)
 */

type SupportedLocale = 'es' | 'en';

const translations = {
  es: {
    appName: 'DOMY',
    tagline: 'Entregas y logística urbana en tiempo real',
    welcome: 'Bienvenido a DOMY',
    loginTitle: 'Ingresa a tu cuenta',
    loginSubtitle: 'Ingresa a tu cuenta para continuar',
    phoneLabel: 'Número Celular',
    phonePlaceholder: 'Ej. 3001234567',
    passwordLabel: 'Contraseña',
    loginButton: 'Iniciar Sesión',
    registerLink: '¿No tienes cuenta? Regístrate aquí',
    downloadApk: 'Descargar APK Android',
    installApp: 'Instalar Aplicación',
    close: 'Cerrar',
    cancel: 'Cancelar',
    accept: 'Aceptar',
    confirm: 'Confirmar',
    loading: 'Cargando...',
    networkError: 'Error de conexión. Intenta de nuevo.',
  },
  en: {
    appName: 'DOMY',
    tagline: 'Real-time urban logistics and delivery platform',
    welcome: 'Welcome to DOMY',
    loginTitle: 'Sign in to your account',
    loginSubtitle: 'Enter your credentials to continue',
    phoneLabel: 'Phone Number',
    phonePlaceholder: 'E.g. +1 555 123 4567',
    passwordLabel: 'Password',
    loginButton: 'Sign In',
    registerLink: "Don't have an account? Sign up here",
    downloadApk: 'Download Android APK',
    installApp: 'Install Application',
    close: 'Close',
    cancel: 'Cancel',
    accept: 'Accept',
    confirm: 'Confirm',
    loading: 'Loading...',
    networkError: 'Connection error. Please try again.',
  },
} as const;

export type TranslationKey = keyof typeof translations.es;

function detectDeviceLocale(): SupportedLocale {
  try {
    const locale = typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : 'es';
    if (locale && locale.toLowerCase().startsWith('en')) {
      return 'en';
    }
  } catch {
    // Si ocurre algún fallo al consultar el dispositivo, fallback a español
  }
  return 'es';
}

let currentLocale: SupportedLocale = detectDeviceLocale();

export const i18n = {
  getLocale(): SupportedLocale {
    return currentLocale;
  },
  setLocale(locale: SupportedLocale) {
    currentLocale = locale;
  },
  t(key: TranslationKey): string {
    const dict = translations[currentLocale] || translations.es;
    return dict[key] || translations.es[key] || key;
  },
  isSpanish(): boolean {
    return currentLocale === 'es';
  },
};
