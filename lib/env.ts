import Constants from 'expo-constants';

export type Env = {
  ACA_API_BASE: string;
  ACA_API_KEY: string;
};

const sanitize = (key: string): string => key.replace(/.(?=.{4})/g, '*');

export function loadEnv(): Env {
  const extras: Record<string, any> = (Constants?.expoConfig as any)?.extra ?? {};
  const ACA_API_BASE = (process.env.ACA_API_BASE ?? extras.ACA_API_BASE ?? '').toString();
  const ACA_API_KEY = (process.env.ACA_API_KEY ?? extras.ACA_API_KEY ?? '').toString();
  if (!ACA_API_BASE) {
    console.warn('[env] ACA_API_BASE is not set');
  }
  if (!ACA_API_KEY) {
    console.warn('[env] ACA_API_KEY is not set');
  } else {
    console.log('[env] Loaded ACA_API_KEY:', sanitize(ACA_API_KEY));
  }
  return { ACA_API_BASE, ACA_API_KEY };
}

export const env = loadEnv();
