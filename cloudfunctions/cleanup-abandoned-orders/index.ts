import { cleanupAbandonedOrders } from '../shared/order-cleanup';
import { ok } from '../shared/utils';

export async function main() {
  const result = await cleanupAbandonedOrders();
  return ok(result);
}
