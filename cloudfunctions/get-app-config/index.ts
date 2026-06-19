import { getClientAppConfig } from '../shared/client-config';
import { ok } from '../shared/utils';

export async function main() {
  return ok(await getClientAppConfig());
}
