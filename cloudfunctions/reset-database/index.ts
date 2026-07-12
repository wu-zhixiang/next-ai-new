import { COLLECTIONS } from '../shared/constants';
import { _, collection } from '../shared/db';
import { seedAppStoreCountries } from '../shared/appstore-country-seed';
import { seedAiAccountEmailDomains } from '../shared/ai-account-email-domain';
import { seedMemberPlans } from '../shared/plan-seed';
import { seedProductTypes } from '../shared/product-type-seed';
import { ok } from '../shared/utils';

interface Event {
  action?: 'invite-rewards';
  confirm?: string;
  dryRun?: boolean;
  includeUsers?: boolean;
  includeMemberPlans?: boolean;
  includeProductTypes?: boolean;
  includeAiAccountEmailDomains?: boolean;
  includeAppStoreCountries?: boolean;
}

type CollectionKey = keyof typeof COLLECTIONS;
type InviteLedgerType = 'invite_reward' | 'invite_milestone';

interface InviteRewardLedgerDoc {
  _id?: string;
  userId?: string;
  type?: string;
  points?: number;
}

interface UserDoc {
  _id?: string;
  pointsBalance?: number;
  aiToolPointsBalance?: number;
  inviterUserId?: string;
}

interface ResetCollectionRef {
  count(): Promise<{ total: number }>;
  where(query: unknown): ResetCollectionRef;
  skip(value: number): ResetCollectionRef;
  limit(value: number): {
    get(): Promise<{ data: Array<{ _id?: string } & Record<string, unknown>> }>;
  };
  doc(id: string): {
    remove(): Promise<unknown>;
    update(payload: { data: unknown }): Promise<unknown>;
  };
}

const CONFIRM_TEXT = 'RESET_TEST_DATABASE';
const INVITE_REWARDS_CONFIRM_TEXT = 'RESET_INVITE_REWARDS';
const INVITE_LEDGER_TYPES: InviteLedgerType[] = ['invite_reward', 'invite_milestone'];
const DEFAULT_CLEAR_COLLECTIONS: CollectionKey[] = [
  'memberships',
  'orders',
  'deliveries',
  'inviteRelations',
  'pointsLedger',
  'emailVerificationCodes',
  'aiNews',
  'aiToolRuns',
  'aiToolAssets',
  'aiToolUsageDaily',
  'aiToolUserUsage',
  'aiToolPointsLedger',
  'aiToolSingleEntitlements',
  'aiToolTemplates',
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

async function listCollectionDocs<T extends { _id?: string }>(
  name: CollectionKey,
  where?: unknown,
): Promise<T[]> {
  const target = collection(name) as unknown as ResetCollectionRef;
  let query = where ? target.where(where) : target;
  const docs: T[] = [];
  let offset = 0;
  while (true) {
    const result = await query.skip(offset).limit(100).get();
    docs.push(...(result.data as T[]));
    if (result.data.length < 100) {
      break;
    }
    offset += 100;
  }
  return docs;
}

async function removeDocs(name: CollectionKey, docs: Array<{ _id?: string }>): Promise<number> {
  const target = collection(name) as unknown as ResetCollectionRef;
  let removed = 0;
  for (const doc of docs) {
    if (!doc._id) {
      continue;
    }
    await target.doc(doc._id).remove();
    removed += 1;
  }
  return removed;
}

function buildDeductions(ledgers: InviteRewardLedgerDoc[]): Map<string, number> {
  const deductions = new Map<string, number>();
  for (const ledger of ledgers) {
    if (!ledger.userId) {
      continue;
    }
    const points = Math.max(0, Math.floor(Number(ledger.points ?? 0)));
    if (points <= 0) {
      continue;
    }
    deductions.set(ledger.userId, (deductions.get(ledger.userId) ?? 0) + points);
  }
  return deductions;
}

function sumDeductions(deductions: Map<string, number>): number {
  let total = 0;
  deductions.forEach((points) => {
    total += points;
  });
  return total;
}

async function applyUserInviteReset(params: {
  tCoinDeductions: Map<string, number>;
  aiToolPointDeductions: Map<string, number>;
}): Promise<number> {
  const target = collection('users') as unknown as ResetCollectionRef;
  const users = await listCollectionDocs<UserDoc>('users');
  let updated = 0;
  for (const user of users) {
    if (!user._id) {
      continue;
    }
    const tCoinDeduction = params.tCoinDeductions.get(user._id) ?? 0;
    const aiToolPointDeduction = params.aiToolPointDeductions.get(user._id) ?? 0;
    const currentPointsBalance = Math.max(0, Math.floor(Number(user.pointsBalance ?? 0)));
    const currentAiToolPointsBalance = Math.max(0, Math.floor(Number(user.aiToolPointsBalance ?? 0)));
    const nextPointsBalance = Math.max(0, currentPointsBalance - tCoinDeduction);
    const nextAiToolPointsBalance = Math.max(0, currentAiToolPointsBalance - aiToolPointDeduction);
    const shouldUpdate = Boolean(user.inviterUserId)
      || nextPointsBalance !== currentPointsBalance
      || nextAiToolPointsBalance !== currentAiToolPointsBalance;
    if (!shouldUpdate) {
      continue;
    }
    await target.doc(user._id).update({
      data: {
        inviterUserId: '',
        pointsBalance: nextPointsBalance,
        aiToolPointsBalance: nextAiToolPointsBalance,
        updatedAt: Date.now(),
      },
    });
    updated += 1;
  }
  return updated;
}

async function resetInviteRewards(event: Event) {
  if (event.confirm !== INVITE_REWARDS_CONFIRM_TEXT) {
    throw new Error(`清除邀请关系需要确认参数 confirm="${INVITE_REWARDS_CONFIRM_TEXT}"`);
  }

  const [inviteRelations, pointsLedgers, aiToolPointsLedgers] = await Promise.all([
    listCollectionDocs('inviteRelations'),
    listCollectionDocs<InviteRewardLedgerDoc>('pointsLedger', { type: _.in(INVITE_LEDGER_TYPES) }),
    listCollectionDocs<InviteRewardLedgerDoc>('aiToolPointsLedger', { type: _.in(INVITE_LEDGER_TYPES) }),
  ]);
  const tCoinDeductions = buildDeductions(pointsLedgers);
  const aiToolPointDeductions = buildDeductions(aiToolPointsLedgers);

  const preview = {
    inviteRelations: inviteRelations.length,
    pointsLedgerInviteRewards: pointsLedgers.length,
    aiToolPointsLedgerInviteRewards: aiToolPointsLedgers.length,
    tCoinUsersToDeduct: tCoinDeductions.size,
    tCoinTotalToDeduct: sumDeductions(tCoinDeductions),
    aiToolPointUsersToDeduct: aiToolPointDeductions.size,
    aiToolPointTotalToDeduct: sumDeductions(aiToolPointDeductions),
  };

  if (event.dryRun) {
    return ok({
      action: 'invite-rewards',
      dryRun: true,
      preview,
    });
  }

  const resetUsersCount = await applyUserInviteReset({
    tCoinDeductions,
    aiToolPointDeductions,
  });
  const removedInviteRelations = await removeDocs('inviteRelations', inviteRelations);
  const removedPointsLedgers = await removeDocs('pointsLedger', pointsLedgers);
  const removedAiToolPointsLedgers = await removeDocs('aiToolPointsLedger', aiToolPointsLedgers);

  return ok({
    action: 'invite-rewards',
    success: true,
    preview,
    resetUsersCount,
    removed: {
      inviteRelations: removedInviteRelations,
      pointsLedgerInviteRewards: removedPointsLedgers,
      aiToolPointsLedgerInviteRewards: removedAiToolPointsLedgers,
    },
  });
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
  if (event.action === 'invite-rewards') {
    return resetInviteRewards(event);
  }

  if (event.confirm !== CONFIRM_TEXT) {
    throw new Error(`危险操作需要确认参数 confirm="${CONFIRM_TEXT}"`);
  }

  const clearCollections: CollectionKey[] = [
    ...DEFAULT_CLEAR_COLLECTIONS,
    ...(event.includeUsers ? (['users'] as CollectionKey[]) : []),
    ...(event.includeMemberPlans ? (['memberPlans'] as CollectionKey[]) : []),
    ...(event.includeProductTypes ? (['productTypes'] as CollectionKey[]) : []),
    ...(event.includeAiAccountEmailDomains ? (['aiAccountEmailDomains'] as CollectionKey[]) : []),
    ...(event.includeAppStoreCountries ? (['appstoreCountries'] as CollectionKey[]) : []),
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
      seedProductTypes: true,
      seedAiAccountEmailDomains: true,
      seedAppStoreCountries: true,
    });
  }

  const removed: Record<string, number> = {};
  for (const name of clearCollections) {
    removed[COLLECTIONS[name]] = await clearCollection(name);
  }
  const resetUserPointsCount = event.includeUsers ? 0 : await resetUserPoints();
  const seededProductTypes = await seedProductTypes();
  const seededAiAccountEmailDomains = await seedAiAccountEmailDomains();
  const seededAppStoreCountries = await seedAppStoreCountries();
  const seededPlans = await seedMemberPlans();

  return ok({
    success: true,
    removed,
    resetUserPointsCount,
    seededProductTypes,
    seededAiAccountEmailDomains,
    seededAppStoreCountries,
    seededPlans,
    includeUsers: Boolean(event.includeUsers),
    includeMemberPlans: Boolean(event.includeMemberPlans),
    includeProductTypes: Boolean(event.includeProductTypes),
    includeAiAccountEmailDomains: Boolean(event.includeAiAccountEmailDomains),
    includeAppStoreCountries: Boolean(event.includeAppStoreCountries),
  });
}
