import { collection } from './db';
import type { OrderRecord } from './types';
import { getPendingOrderExpireAt, isPendingOrderExpired } from './utils';

const ABANDONED_ORDER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface CleanupOptions {
  userId?: string;
  now?: number;
  limit?: number;
}

function getAbandonedAt(order: OrderRecord): number | null {
  if (order.payStatus === 'closed' || order.payStatus === 'failed') {
    return order.closedAt ?? order.updatedAt ?? order.createdAt;
  }

  if (order.payStatus === 'pending' && order.fulfillmentStatus !== 'opening') {
    const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
    return getPendingOrderExpireAt(order.createdAt, order.payExpireAt, lastPayAttemptAt);
  }

  return null;
}

function shouldRemoveOrder(order: OrderRecord, now: number): boolean {
  if (order.payStatus === 'pending') {
    const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
    if (!isPendingOrderExpired(order.createdAt, now, order.payExpireAt, lastPayAttemptAt)) {
      return false;
    }
  }

  const abandonedAt = getAbandonedAt(order);
  return Boolean(abandonedAt && now - abandonedAt >= ABANDONED_ORDER_RETENTION_MS);
}

export async function cleanupAbandonedOrders(options: CleanupOptions = {}): Promise<{ removed: number }> {
  const now = options.now ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? 100, 100));
  const query = options.userId ? { userId: options.userId } : {};
  let removed = 0;
  let scanned = 0;

  while (true) {
    const result = await collection('orders').where(query).skip(scanned).limit(limit).get();
    const orders = result.data as Array<OrderRecord & { _id: string }>;
    if (orders.length === 0) {
      break;
    }

    let batchRemoved = 0;
    for (const order of orders) {
      if (!order._id || !shouldRemoveOrder(order, now)) {
        continue;
      }
      await collection('orders').doc(order._id).remove();
      removed += 1;
      batchRemoved += 1;
    }

    if (batchRemoved === 0) {
      scanned += orders.length;
    }

    if (orders.length < limit) {
      break;
    }
  }

  return { removed };
}
