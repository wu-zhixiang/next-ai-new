import { callCloudFunction } from '@/services/api';

export interface ClientAppConfig {
  enableHomeAuthModal: boolean;
  enableNewsAuthModal: boolean;
  enableProductComplianceMode: boolean;
  paymentType: 'virtual' | 'standard';
}

const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  enableHomeAuthModal: true,
  enableNewsAuthModal: true,
  enableProductComplianceMode: false,
  paymentType: 'virtual',
};

export async function loadClientAppConfig(): Promise<ClientAppConfig> {
  try {
    const config = await callCloudFunction<Partial<ClientAppConfig>>('get-app-config');
    const enableHomeAuthModal = typeof config.enableHomeAuthModal === 'boolean'
      ? config.enableHomeAuthModal
      : config.enableNewsAuthModal !== false;
    return {
      enableHomeAuthModal,
      enableNewsAuthModal: config.enableNewsAuthModal !== false,
      enableProductComplianceMode: config.enableProductComplianceMode === true,
      paymentType: config.paymentType === 'standard' ? 'standard' : 'virtual',
    };
  } catch {
    return DEFAULT_CLIENT_APP_CONFIG;
  }
}
