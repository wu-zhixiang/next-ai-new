export type MembershipStatus = 'opening' | 'active' | 'expired' | 'cancelled' | 'none';
export type ExpireTag = 'normal' | 'within_30d' | 'within_7d' | 'within_3d' | 'expired';
export type PayStatus = 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';
export type FulfillmentStatus = 'pending' | 'opening' | 'fulfilled' | 'failed';

export interface UserRecord {
  _id?: string;
  openid: string;
  unionid?: string;
  mobile: string;
  nickname?: string;
  avatarUrl?: string;
  inviteCode?: string;
  inviterUserId?: string;
  pointsBalance?: number;
  aiAccountRegistered?: boolean;
  aiAccountEmail?: string;
  aiAccountPasswordEncrypted?: string;
  gender?: number;
  status: 'active' | 'disabled';
  subscribeMsgAuth: boolean;
  subscribeMsgAuthAt?: number;
  newsSubscribeMsgAuth?: boolean;
  newsSubscribeMsgAuthAt?: number;
  newsSubscribeMsgQuota?: number;
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
  virtualPaymentProductId?: string;
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
  virtualPaymentProductId?: string;
  orderType: 'purchase' | 'renew';
  amount: number;
  originalAmount?: number;
  pointsDeductionEnabled?: boolean;
  pointsDeducted?: number;
  pointsDeductAmount?: number;
  durationDays: number;
  payStatus: PayStatus;
  fulfillmentStatus?: FulfillmentStatus;
  payChannel: 'wechat_pay' | 'wechat_virtual_pay';
  transactionId?: string;
  prepayId?: string;
  payExpireAt?: number;
  paidAt?: number;
  fulfilledAt?: number;
  operatorNotifiedAt?: number;
  operatorNotifyChannel?: string;
  operatorProcessingAt?: number;
  operatorFailedAt?: number;
  operatorNote?: string;
  closedAt?: number;
  closeReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface InviteRelationRecord {
  _id?: string;
  inviterUserId: string;
  inviteeUserId: string;
  inviteCode: string;
  source?: string;
  status: 'active';
  createdAt: number;
  updatedAt: number;
}

export interface PointsLedgerRecord {
  _id?: string;
  userId: string;
  relatedUserId?: string;
  orderNo?: string;
  type: 'invite_reward' | 'payment_deduct' | 'adjustment';
  direction: 'in' | 'out';
  points: number;
  balanceAfter?: number;
  description: string;
  createdAt: number;
}

export interface EmailVerificationCodeRecord {
  _id?: string;
  email: string;
  userId: string;
  code: string;
  provider: 'openai' | 'unknown';
  from: string;
  subject: string;
  receivedAt: number;
  expiresAt: number;
  usedAt?: number | null;
  createdAt: number;
}

export interface AppStoreEmailVerificationCodeRecord {
  _id?: string;
  email: string;
  code: string;
  from: string;
  subject: string;
  receivedAt: number;
  expiresAt: number;
  usedAt?: number | null;
  createdAt: number;
}

export interface AppStoreAccountRecord {
  _id?: string;
  email: string;
  mobile: string;
  password: string;
  status: 'available' | 'bound' | 'disabled';
  chatgptAccountEmail?: string;
  orderNo?: string;
  userId?: string;
  boundAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AiNewsRecord {
  _id?: string;
  title: string;
  summary: string;
  coverFileId?: string;
  contentMarkdown: string;
  sourceName: string;
  sourceUrl?: string;
  authorName?: string;
  sourcePlatform: 'x' | 'blog' | 'official' | 'manual';
  tags: string[];
  viewCount: number;
  likeCount: number;
  repostCount: number;
  commentCount: number;
  score: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: number;
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

export interface AiNewsView {
  id: string;
  title: string;
  summary: string;
  coverFileId?: string;
  sourceName: string;
  sourceUrl?: string;
  authorName?: string;
  sourcePlatform: AiNewsRecord['sourcePlatform'];
  tags: string[];
  heat: number;
  publishedAt: number;
}

export interface AiNewsDetailView extends AiNewsView {
  contentMarkdown: string;
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
  autoRenewStatus?: 'off' | 'on' | 'cancelled' | 'renew_failed';
}

export interface AiAccountView {
  registered: boolean;
  email?: string;
}
