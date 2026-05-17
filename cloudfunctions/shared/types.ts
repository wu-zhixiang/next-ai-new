export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'none';
export type ExpireTag = 'normal' | 'within_30d' | 'within_7d' | 'within_3d' | 'expired';
export type PayStatus = 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';

export interface UserRecord {
  _id?: string;
  openid: string;
  unionid?: string;
  mobile: string;
  nickname?: string;
  avatarUrl?: string;
  gender?: number;
  status: 'active' | 'disabled';
  subscribeMsgAuth: boolean;
  subscribeMsgAuthAt?: number;
  lastLoginAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MembershipRecord {
  _id?: string;
  userId: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  status: Exclude<MembershipStatus, 'none'>;
  startAt: number;
  endAt: number;
  remainDays: number;
  autoRenewStatus: 'off' | 'on' | 'cancelled' | 'renew_failed';
  autoRenewContractId?: string;
  nextRenewAt?: number;
  renewPrice?: number;
  renewFailCount?: number;
  lastRenewAt?: number;
  lastRenewStatus?: 'success' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface MemberPlanRecord {
  _id?: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  price: number;
  durationDays: number;
  autoRenewEnabled: boolean;
  status: 'on' | 'off';
  sort: number;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DeliveryRecord {
  _id?: string;
  userId: string;
  mobile: string;
  emailAccount?: string;
  chatgptAccount?: string;
  uploadedAt?: number;
  expireAt?: number;
  remainDays?: number;
  expireTag: ExpireTag;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrderRecord {
  _id?: string;
  orderNo: string;
  userId: string;
  membershipId?: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  orderType: 'purchase' | 'renew';
  amount: number;
  durationDays: number;
  payStatus: PayStatus;
  payChannel: 'wechat_pay';
  transactionId?: string;
  prepayId?: string;
  paidAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PlanView {
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  price: number;
  durationDays: number;
  description?: string;
}

export interface MembershipView {
  status: MembershipStatus;
  openStatusLabel?: '立即开通' | '开通中' | '已开通';
  productCode?: string;
  productName?: string;
  planName?: string;
  startAt?: number;
  endAt?: number;
  remainDays?: number;
}
