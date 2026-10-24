import { api } from './api';

export const CURRENT_APP_VERSION = '1.0.7';
export const CURRENT_VERSION_CODE = 8;

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
  currentVersion: string;
  latestVersion: string;
  apkDownloadUrl: string;
  releaseNotes: string;
}

let cachedCheck: VersionCheckResult | null = null;
let lastCheckTime = 0;

export const versionService = {
  getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
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

        cachedCheck = {
          isOutdated,
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
