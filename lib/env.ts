export type Env = {
  ACA_API_BASE: string;
  ACA_API_KEY: string;
};

const getBackendUrl = () => {
  // Use the same backend URL as tRPC
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }
  // Fallback for local development
  return 'http://localhost:3000';
};

export function loadEnv(): Env {
  const backendUrl = getBackendUrl();
  
  // Use backend proxy for ACA API
  const ACA_API_BASE = `${backendUrl}/api/aca`;
  const ACA_API_KEY = 'proxy'; // Not needed when using proxy
  
  console.log('[env] Using backend proxy for ACA API:', ACA_API_BASE);
  
  return { ACA_API_BASE, ACA_API_KEY };
}

export const env = loadEnv();
