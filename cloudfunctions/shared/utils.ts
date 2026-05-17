import type { ApiResponse, ExpireTag, MembershipRecord, MembershipStatus } from './types';
import { SUCCESS_CODE } from './constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_ORDER_TTL_MS = 30 * 60 * 1000;

export function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    code: SUCCESS_CODE,
    message,
    data,
  };
}

export function calcRemainDays(endAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endAt - now) / DAY_MS));
}

export function calcExpireTag(endAt: number, now = Date.now()): ExpireTag {
  if (endAt < now) {
    return 'expired';
  }

  const remainDays = calcRemainDays(endAt, now);
  if (remainDays <= 3) {
    return 'within_3d';
  }
  if (remainDays <= 7) {
    return 'within_7d';
  }
  if (remainDays <= 30) {
    return 'within_30d';
  }
  return 'normal';
}

export function normalizeMembership(record?: MembershipRecord | null) {
  if (!record) {
    return {
      status: 'none' as const,
      openStatusLabel: getMembershipOpenStatusLabel('none'),
    };
  }

  return {
    status: record.status,
    openStatusLabel: getMembershipOpenStatusLabel(record.status),
    productCode: record.productCode,
    productName: record.productName,
    planName: record.planName,
    startAt: record.startAt,
    endAt: record.endAt,
    remainDays: calcRemainDays(record.endAt),
  };
}

export function getMembershipOpenStatusLabel(status: MembershipStatus): '立即开通' | '开通中' | '已开通' {
  if (status === 'active') {
    return '已开通';
  }
  if (status === 'none') {
    return '立即开通';
  }
  return '开通中';
}

export function createOrderNo(prefix = 'ORD'): string {
  const time = Date.now().toString();
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `${prefix}${time}${random}`;
}

export function maskMobile(mobile?: string): string {
  if (!mobile) {
    return '';
  }

  const normalized = mobile.replace(/\s+/g, '');
  if (/^\d{11}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
  }

  return mobile;
}

export function isValidMainlandMobile(mobile?: string): boolean {
  if (!mobile) {
    return false;
  }

  return /^1\d{10}$/.test(mobile.replace(/\s+/g, ''));
}

export function normalizeMobile(mobile?: string): string {
  return mobile?.replace(/\s+/g, '') ?? '';
}

export function toWechatPaymentAmount(amount: number): number {
  return Math.round(amount * 100);
}

export function parseWechatPayTime(value?: string): number {
  if (!value || !/^\d{14}$/.test(value)) {
    return Date.now();
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));

  return new Date(year, month, day, hour, minute, second).getTime();
}

export function getPendingOrderExpireAt(createdAt: number, payExpireAt?: number, lastPayAttemptAt?: number): number {
  return payExpireAt ?? (lastPayAttemptAt ? lastPayAttemptAt + PENDING_ORDER_TTL_MS : createdAt + PENDING_ORDER_TTL_MS);
}

export function isPendingOrderExpired(createdAt: number, now = Date.now(), payExpireAt?: number, lastPayAttemptAt?: number): boolean {
  return now > getPendingOrderExpireAt(createdAt, payExpireAt, lastPayAttemptAt);
}
