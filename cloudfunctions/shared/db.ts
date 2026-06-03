import cloud from 'wx-server-sdk';
import { COLLECTIONS } from './constants';
import type {
  DeliveryRecord,
  EmailVerificationCodeRecord,
  InviteRelationRecord,
  MemberPlanRecord,
  MembershipRecord,
  OrderRecord,
  UserRecord,
} from './types';

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

export const app = cloud;
export const db = cloud.database();

type CollectionName = keyof typeof COLLECTIONS;
interface DatabaseCommand {
  in(values: unknown[]): unknown;
  inc(value: number): unknown;
  gt(value: number): unknown;
}

export const _ = db.command as DatabaseCommand;

export function collection(name: CollectionName) {
  return db.collection(COLLECTIONS[name]);
}

export async function ensureCollection(name: CollectionName): Promise<void> {
  const target = COLLECTIONS[name];
  try {
    await (db as unknown as { createCollection(collectionName: string): Promise<unknown> }).createCollection(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.includes('already exists')
      && !message.includes('Collection already exists')
      && !message.includes('already exist')
      && !message.includes('DATABASE_COLLECTION_ALREADY_EXIST')
      && !message.includes('ResourceExist')
      && !message.includes('Table exist')
    ) {
      throw error;
    }
  }
}

export async function getUserByOpenId(openid: string): Promise<(UserRecord & { _id: string }) | null> {
  const result = await collection('users').where({ openid }).limit(1).get();
  return (result.data[0] as (UserRecord & { _id: string }) | undefined) ?? null;
}

export async function getUserById(userId: string): Promise<(UserRecord & { _id: string }) | null> {
  const result = await collection('users').doc(userId).get();
  return (result.data as (UserRecord & { _id: string }) | undefined) ?? null;
}

export async function getUserByInviteCode(inviteCode: string): Promise<(UserRecord & { _id: string }) | null> {
  const result = await collection('users').where({ inviteCode }).limit(1).get();
  return (result.data[0] as (UserRecord & { _id: string }) | undefined) ?? null;
}

export async function getUserByAiAccountEmail(email: string): Promise<(UserRecord & { _id: string }) | null> {
  const result = await collection('users').where({ aiAccountEmail: email.toLowerCase() }).limit(1).get();
  return (result.data[0] as (UserRecord & { _id: string }) | undefined) ?? null;
}

export async function getMembershipByUserId(
  userId: string,
  productCode?: string,
): Promise<(MembershipRecord & { _id: string }) | null> {
  const query = productCode ? { userId, productCode } : { userId };
  const result = await collection('memberships').where(query).limit(1).get();
  return (result.data[0] as (MembershipRecord & { _id: string }) | undefined) ?? null;
}

export async function listMembershipsByUserId(userId: string): Promise<Array<MembershipRecord & { _id: string }>> {
  const result = await collection('memberships').where({ userId }).get();
  return result.data as Array<MembershipRecord & { _id: string }>;
}

export async function getDeliveryByUserId(userId: string): Promise<(DeliveryRecord & { _id: string }) | null> {
  const result = await collection('deliveries').where({ userId }).limit(1).get();
  return (result.data[0] as (DeliveryRecord & { _id: string }) | undefined) ?? null;
}

export async function getPlanByCode(planCode: string): Promise<(MemberPlanRecord & { _id: string }) | null> {
  const result = await collection('memberPlans').where({ planCode, status: 'on' }).limit(1).get();
  return (result.data[0] as (MemberPlanRecord & { _id: string }) | undefined) ?? null;
}

export async function getOrderByNo(orderNo: string): Promise<(OrderRecord & { _id: string }) | null> {
  const result = await collection('orders').where({ orderNo }).limit(1).get();
  return (result.data[0] as (OrderRecord & { _id: string }) | undefined) ?? null;
}

export async function getLatestPendingOrderByUserId(
  userId: string,
  productCode?: string,
): Promise<(OrderRecord & { _id: string }) | null> {
  const query = productCode ? { userId, productCode, payStatus: 'pending' } : { userId, payStatus: 'pending' };
  const result = await collection('orders').where(query).get();
  const orders = result.data as Array<OrderRecord & { _id: string }>;
  return orders.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
}

export async function listOrdersByUserId(userId: string): Promise<Array<OrderRecord & { _id: string }>> {
  const result = await collection('orders').where({ userId }).get();
  return (result.data as Array<OrderRecord & { _id: string }>).sort((left, right) => right.createdAt - left.createdAt);
}

export async function listPendingOrdersByUserId(userId: string): Promise<Array<OrderRecord & { _id: string }>> {
  const result = await collection('orders').where({ userId, payStatus: 'pending' }).get();
  return result.data as Array<OrderRecord & { _id: string }>;
}

export async function listInviteRelationsByInviterId(
  inviterUserId: string,
): Promise<Array<InviteRelationRecord & { _id: string }>> {
  const result = await collection('inviteRelations').where({ inviterUserId }).get();
  return (result.data as Array<InviteRelationRecord & { _id: string }>).sort(
    (left, right) => right.createdAt - left.createdAt,
  );
}

export async function getLatestEmailVerificationCode(
  emailOrUserId: string,
  now = Date.now(),
): Promise<(EmailVerificationCodeRecord & { _id: string }) | null> {
  const result = await collection('emailVerificationCodes')
    .where({
      userId: emailOrUserId,
    })
    .get();
  const userCodes = result.data as Array<EmailVerificationCodeRecord & { _id: string }>;
  const fallbackResult = userCodes.length > 0
    ? { data: userCodes }
    : await collection('emailVerificationCodes')
      .where({
        email: emailOrUserId.trim().toLowerCase(),
      })
      .get();
  const codes = (fallbackResult.data as Array<EmailVerificationCodeRecord & { _id: string }>)
    .filter((item) => item.expiresAt > now && !item.usedAt)
    .sort((left, right) => right.receivedAt - left.receivedAt);
  return codes[0] ?? null;
}

export async function getLatestUnusedEmailVerificationCode(
  emailOrUserId: string,
): Promise<(EmailVerificationCodeRecord & { _id: string }) | null> {
  const result = await collection('emailVerificationCodes')
    .where({
      userId: emailOrUserId,
    })
    .get();
  const userCodes = result.data as Array<EmailVerificationCodeRecord & { _id: string }>;
  const fallbackResult = userCodes.length > 0
    ? { data: userCodes }
    : await collection('emailVerificationCodes')
      .where({
        email: emailOrUserId.trim().toLowerCase(),
      })
      .get();
  const codes = (fallbackResult.data as Array<EmailVerificationCodeRecord & { _id: string }>)
    .filter((item) => !item.usedAt)
    .sort((left, right) => right.receivedAt - left.receivedAt);
  return codes[0] ?? null;
}
