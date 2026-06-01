import cloud from 'wx-server-sdk';
import { ok } from '../shared/utils';

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const DEFAULT_CONFIG = {
  enableNewsAuthModal: true,
};

interface AppConfigRecord {
  enableNewsAuthModal?: boolean;
}

export async function main() {
  try {
    const result = await db.collection('app_config').doc('client').get();
    const config = (result.data ?? {}) as AppConfigRecord;
    return ok({
      enableNewsAuthModal: config.enableNewsAuthModal !== false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('collection not exists')
      || message.includes('DATABASE_COLLECTION_NOT_EXIST')
      || message.includes('Table not exist')
      || message.includes('document.get:fail')
      || message.includes('cannot find document')
    ) {
      return ok(DEFAULT_CONFIG);
    }
    throw error;
  }
}
