import { _, collection, getMembershipByUserId, getUserById } from './db';
import type { MembershipRecord, OrderRecord, PointsLedgerRecord } from './types';
import { calcRemainDays } from './utils';

function calcInviteRewardPoints(amount: number): number {
  // 1 元 = 100 积分，邀请奖励为实付金额的 10%，测试 0.01 元订单至少返 1 积分，便于联调验收。
  return Math.max(1, Math.floor(amount * 100 * 0.1));
}

async function rewardInviterOnce(order: OrderRecord & { _id: string }, paidAt: number): Promise<void> {
  const invitee = await getUserById(order.userId);
  if (!invitee?.inviterUserId) {
    console.info('invite.reward.skipped', {
      reason: 'inviter_missing',
      orderNo: order.orderNo,
      userId: order.userId,
    });
    return;
  }

  const existing = await collection('pointsLedger')
    .where({
      type: 'invite_reward',
      orderNo: order.orderNo,
      userId: invitee.inviterUserId,
    })
    .limit(1)
    .get();
  if (existing.data[0]) {
    console.info('invite.reward.skipped', {
      reason: 'ledger_exists',
      orderNo: order.orderNo,
      inviterUserId: invitee.inviterUserId,
    });
    return;
  }

  const rewardPoints = calcInviteRewardPoints(order.amount);
  await collection('users').doc(invitee.inviterUserId).update({
    data: {
      pointsBalance: _.inc(rewardPoints),
      updatedAt: paidAt,
    },
  });

  const inviter = await getUserById(invitee.inviterUserId);
  const ledger: PointsLedgerRecord = {
    userId: invitee.inviterUserId,
    relatedUserId: order.userId,
    orderNo: order.orderNo,
    type: 'invite_reward',
    direction: 'in',
    points: rewardPoints,
    balanceAfter: inviter?.pointsBalance,
    description: `邀请用户订阅 ${order.planName} 返还积分`,
    createdAt: paidAt,
  };
  await collection('pointsLedger').add({ data: ledger });
  console.info('invite.reward.created', {
    orderNo: order.orderNo,
    inviterUserId: invitee.inviterUserId,
    inviteeUserId: order.userId,
    points: rewardPoints,
  });
}

export async function markOrderPaidAndOpenMembership(
  order: OrderRecord & { _id: string },
  options: {
    transactionId?: string;
    paidAt?: number;
  } = {},
): Promise<void> {
  if (order.payStatus !== 'paid') {
    const paidAt = options.paidAt ?? Date.now();
    await collection('orders').doc(order._id).update({
      data: {
        payStatus: 'paid',
        transactionId: options.transactionId ?? order.transactionId ?? '',
        paidAt,
        updatedAt: paidAt,
      },
    });

    const existingMembership = await getMembershipByUserId(order.userId, order.productCode);
    const startAt = existingMembership && existingMembership.endAt > paidAt ? existingMembership.endAt : paidAt;
    const endAt = startAt + order.durationDays * 24 * 60 * 60 * 1000;

    if (existingMembership) {
      await collection('memberships').doc(existingMembership._id).update({
        data: {
          productCode: order.productCode,
          productName: order.productName,
          planCode: order.planCode,
          planName: order.planName,
          status: 'active',
          startAt: existingMembership.startAt,
          endAt,
          remainDays: calcRemainDays(endAt, paidAt),
          updatedAt: paidAt,
        },
      });
    } else {
      const membership: MembershipRecord = {
        userId: order.userId,
        productCode: order.productCode,
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        status: 'active',
        startAt: paidAt,
        endAt,
        remainDays: calcRemainDays(endAt, paidAt),
        autoRenewStatus: 'off',
        createdAt: paidAt,
        updatedAt: paidAt,
      };
      await collection('memberships').add({ data: membership });
    }
  }

  await rewardInviterOnce(order, options.paidAt ?? order.paidAt ?? Date.now());
}
