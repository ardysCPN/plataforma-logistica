let detectedVersion = '1.0.8';
let detectedVersionCode = 9;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants');
  const config = Constants?.default?.expoConfig || Constants?.expoConfig;
  if (config?.version) detectedVersion = config.version;
  if (config?.android?.versionCode) detectedVersionCode = config.android.versionCode;
} catch {
  // Fallback para entornos de test unitarios Jest Node
}

export const CURRENT_APP_VERSION = detectedVersion;
export const CURRENT_VERSION_CODE = detectedVersionCode;
import { api } from './api';

export interface AppVersionInfo {
  latestVersion: string;
  latestVersionCode: number;
  minRequiredVersion: string;
  apkDownloadUrl: string;
  releaseNotes: string;
  releaseDate?: string;
}

export interface VersionCheckResult {
  isOutdated: boolean;
  isMandatory: boolean;
  currentVersion: string;
  latestVersion: string;
  apkDownloadUrl: string;
  releaseNotes: string;
}

let cachedCheck: VersionCheckResult | null = null;
let lastCheckTime = 0;
let dismissedForSession = false;

export const versionService = {
  getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
  },

  dismissPromptForSession() {
    dismissedForSession = true;
  },

  isDismissedForSession(): boolean {
    return dismissedForSession;
  },

  resetSessionDismissal() {
    dismissedForSession = false;
  },

  async checkVersion(force = false): Promise<VersionCheckResult> {
    const now = Date.now();
    // Reutilizar cache por 2 minutos si no se fuerza
    if (!force && cachedCheck && now - lastCheckTime < 120000) {
      return cachedCheck;
    }

    try {
      const res = await api.get<AppVersionInfo>('/api/version');
      if (res.data && res.data.latestVersion) {
        const isOutdated = this.compareVersions(CURRENT_APP_VERSION, res.data.latestVersion) < 0;
        const isMandatory = res.data.minRequiredVersion
          ? this.compareVersions(CURRENT_APP_VERSION, res.data.minRequiredVersion) < 0
          : false;

        cachedCheck = {
          isOutdated,
          isMandatory,
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: res.data.latestVersion,
          apkDownloadUrl: res.data.apkDownloadUrl || 'https://domiapp.adhsolutions.tech/downloads/domy.apk',
          releaseNotes: res.data.releaseNotes || 'Actualizaciones de rendimiento y mejoras.',
        };
        lastCheckTime = now;
        return cachedCheck;
      }
    } catch {
      // Si falla la red, asumir que está al día
    }

    return {
      isOutdated: false,
      isMandatory: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      apkDownloadUrl: 'https://domiapp.adhsolutions.tech/downloads/domy.apk',
      releaseNotes: '',
    };
  },

  /**
   * Compara dos cadenas de versión semántica (ej. '1.0.3' vs '1.0.4')
   * Retorna -1 si v1 < v2, 0 si son iguales, 1 si v1 > v2
   */
  compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
    const p2 = v2.split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(p1.length, p2.length);

    for (let i = 0; i < len; i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }
    return 0;
  },
};
