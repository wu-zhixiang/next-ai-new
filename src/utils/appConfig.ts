import { callCloudFunction } from '@/services/api';

export interface ClientAppConfig {
  enableNewsAuthModal: boolean;
  enableProductComplianceMode: boolean;
}

const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  enableNewsAuthModal: true,
  enableProductComplianceMode: false,
};

export async function loadClientAppConfig(): Promise<ClientAppConfig> {
  try {
    const config = await callCloudFunction<Partial<ClientAppConfig>>('get-app-config');
    return {
      enableNewsAuthModal: config.enableNewsAuthModal !== false,
      enableProductComplianceMode: config.enableProductComplianceMode === true,
    };
  } catch {
    return DEFAULT_CLIENT_APP_CONFIG;
  }
}
