import { callCloudFunction } from '@/services/api';

export interface ClientAppConfig {
  enableNewsAuthModal: boolean;
  enableProductComplianceMode: boolean;
  paymentType: 'virtual' | 'standard';
}

const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  enableNewsAuthModal: true,
  enableProductComplianceMode: false,
  paymentType: 'virtual',
};

export async function loadClientAppConfig(): Promise<ClientAppConfig> {
  try {
    const config = await callCloudFunction<Partial<ClientAppConfig>>('get-app-config');
    return {
      enableNewsAuthModal: config.enableNewsAuthModal !== false,
      enableProductComplianceMode: config.enableProductComplianceMode === true,
      paymentType: config.paymentType === 'standard' ? 'standard' : 'virtual',
    };
  } catch {
    return DEFAULT_CLIENT_APP_CONFIG;
  }
}
