import cloud from 'wx-server-sdk';
import { normalizePaymentType, type PaymentType } from './payment-config';

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

export interface ClientAppConfig {
  enableHomeAuthModal: boolean;
  enableNewsAuthModal: boolean;
  enableProductComplianceMode: boolean;
  paymentType: PaymentType;
}

const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  enableHomeAuthModal: true,
  enableNewsAuthModal: true,
  enableProductComplianceMode: false,
  paymentType: 'virtual',
};

interface AppConfigRecord {
  enableHomeAuthModal?: boolean;
  enableNewsAuthModal?: boolean;
  enableProductComplianceMode?: boolean;
  paymentType?: unknown;
}

function isMissingConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('collection not exists')
    || message.includes('DATABASE_COLLECTION_NOT_EXIST')
    || message.includes('Table not exist')
    || message.includes('document.get:fail')
    || message.includes('cannot find document')
  );
}

export async function getClientAppConfig(): Promise<ClientAppConfig> {
  try {
    const result = await db.collection('app_config').doc('client').get();
    const config = (result.data ?? {}) as AppConfigRecord;
    const enableHomeAuthModal = typeof config.enableHomeAuthModal === 'boolean'
      ? config.enableHomeAuthModal
      : config.enableNewsAuthModal !== false;
    return {
      enableHomeAuthModal,
      enableNewsAuthModal: config.enableNewsAuthModal !== false,
      enableProductComplianceMode: config.enableProductComplianceMode === true,
      paymentType: normalizePaymentType(config.paymentType),
    };
  } catch (error) {
    if (isMissingConfigError(error)) {
      return DEFAULT_CLIENT_APP_CONFIG;
    }
    throw error;
  }
}
