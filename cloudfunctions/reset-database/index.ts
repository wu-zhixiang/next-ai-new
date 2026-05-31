import { COLLECTIONS } from '../shared/constants';
import { collection } from '../shared/db';
import { seedMemberPlans } from '../shared/plan-seed';
import { ok } from '../shared/utils';

interface Event {
  confirm?: string;
  dryRun?: boolean;
  includeUsers?: boolean;
  includeMemberPlans?: boolean;
}

type CollectionKey = keyof typeof COLLECTIONS;
interface ResetCollectionRef {
  count(): Promise<{ total: number }>;
  limit(value: number): {
    get(): Promise<{ data: Array<{ _id?: string }> }>;
  };
  doc(id: string): {
    remove(): Promise<unknown>;
    update(payload: { data: unknown }): Promise<unknown>;
  };
}

const CONFIRM_TEXT = 'RESET_TEST_DATABASE';
const DEFAULT_CLEAR_COLLECTIONS: CollectionKey[] = [
  'memberships',
  'orders',
  'deliveries',
  'inviteRelations',
  'pointsLedger',
  'emailVerificationCodes',
  'aiNews',
  'reminderLogs',
  'auditLogs',
];

async function countCollection(name: CollectionKey): Promise<number> {
  const result = await (collection(name) as unknown as ResetCollectionRef).count();
  return result.total;
}

async function clearCollection(name: CollectionKey): Promise<number> {
  const target = collection(name) as unknown as ResetCollectionRef;
  let removed = 0;
  while (true) {
    const result = await target.limit(100).get();
    const docs = result.data;
    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      if (!doc._id) {
        continue;
      }
      await target.doc(doc._id).remove();
      removed += 1;
    }
  }
  return removed;
}

async function resetUserPoints(): Promise<number> {
  const users = collection('users') as unknown as ResetCollectionRef;
  let updated = 0;
  while (true) {
    const result = await users.limit(100).get();
    const docs = result.data.filter((doc) => Boolean(doc._id));
    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      if (!doc._id) {
        continue;
      }
      await users.doc(doc._id).update({
        data: {
          pointsBalance: 0,
          updatedAt: Date.now(),
        },
      });
      updated += 1;
    }

    if (docs.length < 100) {
      break;
    }
  }
  return updated;
}

export async function main(event: Event = {}) {
  if (event.confirm !== CONFIRM_TEXT) {
    throw new Error(`危险操作需要确认参数 confirm="${CONFIRM_TEXT}"`);
  }

  const clearCollections: CollectionKey[] = [
    ...DEFAULT_CLEAR_COLLECTIONS,
    ...(event.includeUsers ? (['users'] as CollectionKey[]) : []),
    ...(event.includeMemberPlans ? (['memberPlans'] as CollectionKey[]) : []),
  ];

  if (event.dryRun) {
    const counts: Record<string, number> = {};
    for (const name of clearCollections) {
      counts[COLLECTIONS[name]] = await countCollection(name);
    }
    if (!event.includeUsers) {
      counts.userPointsToReset = await countCollection('users');
    }
    return ok({
      dryRun: true,
      clearCollections: clearCollections.map((name) => COLLECTIONS[name]),
      counts,
      seedMemberPlans: true,
    });
  }

  const removed: Record<string, number> = {};
  for (const name of clearCollections) {
    removed[COLLECTIONS[name]] = await clearCollection(name);
  }
  const resetUserPointsCount = event.includeUsers ? 0 : await resetUserPoints();
  const seededPlans = await seedMemberPlans();

  return ok({
    success: true,
    removed,
    resetUserPointsCount,
    seededPlans,
    includeUsers: Boolean(event.includeUsers),
    includeMemberPlans: Boolean(event.includeMemberPlans),
  });
}
