import { _, collection, getMembershipByUserId, getUserById } from './db';
import type { MembershipRecord, OrderRecord, PointsLedgerRecord } from './types';
import { calcMembershipRemainDays } from './utils';

function calcInviteRewardPoints(amount: number): number {
  // 1 积分 = 1 元；邀请奖励按被邀请人实付金额的 10% 向下取整。
  if (amount <= 0) {
    return 0;
  }
  return Math.floor(amount * 0.1);
}

async function deductPaymentPointsOnce(order: OrderRecord & { _id: string }, paidAt: number): Promise<void> {
  const points = Math.max(0, Math.floor(order.pointsDeducted ?? 0));
  if (points <= 0) {
    return;
  }

  const existing = await collection('pointsLedger')
    .where({
      type: 'payment_deduct',
      orderNo: order.orderNo,
      userId: order.userId,
    })
    .limit(1)
    .get();
  if (existing.data[0]) {
    console.info('points.deduct.skipped', {
      reason: 'ledger_exists',
      orderNo: order.orderNo,
      userId: order.userId,
    });
    return;
  }

  await collection('users').doc(order.userId).update({
    data: {
      pointsBalance: _.inc(-points),
      updatedAt: paidAt,
    },
  });

  const user = await getUserById(order.userId);
  const ledger: PointsLedgerRecord = {
    userId: order.userId,
    orderNo: order.orderNo,
    type: 'payment_deduct',
    direction: 'out',
    points,
    balanceAfter: user?.pointsBalance,
    description: `订阅 ${order.planName} 抵扣积分`,
    createdAt: paidAt,
  };
  await collection('pointsLedger').add({ data: ledger });
  console.info('points.deduct.created', {
    orderNo: order.orderNo,
    userId: order.userId,
    points,
  });
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
  if (rewardPoints <= 0) {
    console.info('invite.reward.skipped', {
      reason: 'zero_paid_amount',
      orderNo: order.orderNo,
      inviterUserId: invitee.inviterUserId,
    });
    return;
  }
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

export async function markOrderPaidAndStartOpening(
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
        fulfillmentStatus: 'opening',
        transactionId: options.transactionId ?? order.transactionId ?? '',
        paidAt,
        updatedAt: paidAt,
      },
    });

    const existingMembership = await getMembershipByUserId(order.userId, order.productCode);
    const startAt = existingMembership?.startAt ?? paidAt;
    const endAt = existingMembership?.endAt ?? paidAt;

    if (existingMembership) {
      await collection('memberships').doc(existingMembership._id).update({
        data: {
          productCode: order.productCode,
          productName: order.productName,
          planCode: order.planCode,
          planName: order.planName,
          status: 'opening',
          startAt,
          endAt,
          remainDays: existingMembership.status === 'active' ? calcMembershipRemainDays(existingMembership, paidAt) : 0,
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
        status: 'opening',
        startAt: paidAt,
        endAt: paidAt,
        remainDays: 0,
        autoRenewStatus: 'off',
        createdAt: paidAt,
        updatedAt: paidAt,
      };
      await collection('memberships').add({ data: membership });
    }
  }

  const finalizedAt = options.paidAt ?? order.paidAt ?? Date.now();
  await deductPaymentPointsOnce(order, finalizedAt);
  await rewardInviterOnce(order, finalizedAt);
}

export async function fulfillPaidOrderMembership(
  order: OrderRecord & { _id: string },
  options: {
    fulfilledAt?: number;
  } = {},
): Promise<void> {
  if (order.payStatus !== 'paid') {
    throw new Error('订单未支付，不能确认开通');
  }
  if (order.fulfillmentStatus === 'fulfilled') {
    return;
  }

  const fulfilledAt = options.fulfilledAt ?? Date.now();
  const existingMembership = await getMembershipByUserId(order.userId, order.productCode);
  const startAt = existingMembership && existingMembership.status === 'active' && existingMembership.endAt > fulfilledAt
    ? existingMembership.endAt
    : fulfilledAt;
  const endAt = startAt + order.durationDays * 24 * 60 * 60 * 1000;

  if (existingMembership) {
    await collection('memberships').doc(existingMembership._id).update({
      data: {
        productCode: order.productCode,
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        status: 'active',
        startAt,
        endAt,
        remainDays: calcMembershipRemainDays({ endAt, planCode: order.planCode }, fulfilledAt),
        updatedAt: fulfilledAt,
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
      startAt,
      endAt,
      remainDays: calcMembershipRemainDays({ endAt, planCode: order.planCode }, fulfilledAt),
      autoRenewStatus: 'off',
      createdAt: fulfilledAt,
      updatedAt: fulfilledAt,
    };
    await collection('memberships').add({ data: membership });
  }

  await collection('orders').doc(order._id).update({
    data: {
      fulfillmentStatus: 'fulfilled',
      fulfilledAt,
      updatedAt: fulfilledAt,
    },
  });
}
