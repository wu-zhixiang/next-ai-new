import type {
  AiToolId,
  AiToolOutputType,
  AiToolRunStatus,
  AiToolSource,
  AiToolUsageView,
} from './ai-tool-core';

export type MembershipStatus = 'opening' | 'active' | 'expired' | 'cancelled' | 'none';
export type ExpireTag = 'normal' | 'within_30d' | 'within_7d' | 'within_3d' | 'expired';
export type PayStatus = 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';
export type FulfillmentStatus = 'pending' | 'opening' | 'fulfilled' | 'failed';
export type PayChannel = 'wechat_pay' | 'wechat_virtual_pay';
export type InvoiceStatus = 'none' | 'submitted' | 'processing' | 'issued' | 'failed' | 'rejected';
export type OrderType = 'purchase' | 'renew' | 'tool_single';

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
  aiToolPointsBalance?: number;
  aiAccountRegistered?: boolean;
  aiAccountEmail?: string;
  aiAccountPasswordEncrypted?: string;
  invoiceTitleType?: 'personal' | 'company';
  invoiceTitle?: string;
  invoiceTaxNo?: string;
  invoiceEmail?: string;
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
  pid?: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  virtualPaymentProductId?: string;
  price: number;
  totalAiPoints?: number;
  durationDays: number;
  autoRenewEnabled: boolean;
  complianceEnabled?: boolean;
  status: 'on' | 'off';
  sort: number;
  description?: string;
  complianceDisplay?: {
    productName: string;
    planName: string;
    description?: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ProductTypeRecord {
  _id?: string;
  productCode: string;
  productName: string;
  label: string;
  tag: string;
  avatarUrl?: string;
  detailPageUrl?: string;
  available: boolean;
  description: string;
  introHighlights?: Array<{
    title: string;
    description: string;
  }>;
  complianceEnabled?: boolean;
  complianceDisplay?: {
    productName: string;
    label: string;
    tag: string;
    avatarUrl?: string;
    detailPageUrl?: string;
    description: string;
    introHighlights?: Array<{
      title: string;
      description: string;
    }>;
  };
  sort: number;
  status: 'on' | 'off';
  createdAt: number;
  updatedAt: number;
}

export interface AiAccountEmailDomainRecord {
  _id?: string;
  domain: string;
  available: boolean;
  status: 'on' | 'off';
  sort: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppStoreCountryRecord {
  _id?: string;
  countryCode: string;
  countryName: string;
  dialingCode: string;
  available: boolean;
  sort: number;
  status: 'on' | 'off';
  createdAt: number;
  updatedAt: number;
}

export interface InviteMilestoneConfig {
  id: string;
  inviteCount: number;
  rewardPoints: number;
  enabled: boolean;
  description?: string;
}

export interface PointsConfigRecord {
  _id?: string;
  configId: 'default';
  pointsPerYuan: number;
  inviteBaseRewardPoints: number;
  inviteMilestones: InviteMilestoneConfig[];
  createdAt: number;
  updatedAt: number;
}

export type AdminFileUsage = 'icon' | 'image' | 'document' | 'other';

export interface AdminFileRecord {
  _id?: string;
  fileId: string;
  cloudPath: string;
  name: string;
  displayName: string;
  usage: AdminFileUsage;
  note?: string;
  size: number;
  mimeType: string;
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
  orderType: OrderType;
  amount: number;
  originalAmount?: number;
  pointsDeductionEnabled?: boolean;
  pointsDeducted?: number;
  pointsDeductAmount?: number;
  totalAiPoints?: number;
  toolId?: string;
  toolName?: string;
  toolPointCost?: number;
  durationDays: number;
  payStatus: PayStatus;
  fulfillmentStatus?: FulfillmentStatus;
  payChannel: PayChannel;
  transactionId?: string;
  prepayId?: string;
  payExpireAt?: number;
  paidAt?: number;
  fulfilledAt?: number;
  invoiceStatus?: InvoiceStatus;
  invoiceNo?: string;
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

export interface AiToolUserUsageRecord {
  _id?: string;
  userId: string;
  openid: string;
  toolId: string;
  trialUsed: number;
  consumeCount: number;
  updatedAt: number;
  createdAt: number;
}

export interface AiToolPointsLedgerRecord {
  _id?: string;
  userId: string;
  openid?: string;
  toolId?: string;
  orderNo?: string;
  runId?: string;
  type: 'plan_grant' | 'tool_consume' | 'single_purchase' | 'adjustment';
  direction: 'in' | 'out';
  points: number;
  balanceAfter?: number;
  description: string;
  createdAt: number;
}

export interface AiToolSingleEntitlementRecord {
  _id?: string;
  userId: string;
  openid: string;
  toolId: string;
  orderNo: string;
  status: 'available' | 'used';
  usedRunId?: string;
  usedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface InvoiceRequestRecord {
  _id?: string;
  invoiceNo: string;
  userId: string;
  openid: string;
  scene?: 'WITH_WECHATPAY' | 'WITHOUT_WECHATPAY';
  fapiaoApplyId?: string;
  fapiaoId?: string;
  wechatTransactionId?: string;
  orderNos: string[];
  orders: Array<{
    orderNo: string;
    productCode: string;
    productName: string;
    planCode: string;
    planName: string;
    amount: number;
    paidAt?: number;
    fulfilledAt?: number;
  }>;
  amount: number;
  titleType: 'personal' | 'company';
  title: string;
  taxNo?: string;
  email: string;
  status: Exclude<InvoiceStatus, 'none'>;
  operatorNote?: string;
  rejectReason?: string;
  failReason?: string;
  wechatFapiaoStatus?: string;
  cardOpenid?: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceNoFromWechat?: string;
  invoiceFileUrl?: string;
  invoiceFileId?: string;
  invoiceDownloadUrl?: string;
  invoiceDownloadUrlExpireAt?: number;
  sm3Digest?: string;
  issuedAt?: number;
  operatorUpdatedAt?: number;
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
  milestoneKey?: string;
  orderNo?: string;
  type: 'invite_reward' | 'invite_milestone' | 'payment_deduct' | 'adjustment';
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
  provider: 'openai' | 'claude' | 'unknown';
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
  provider?: 'apple' | 'unknown';
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
  countryCode?: string;
  countryName?: string;
  productCode?: string;
  productName?: string;
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
  mediaType?: 'article' | 'video';
  videoFileId?: string;
  videoPosterFileId?: string;
  videoSourceUrl?: string;
  videoDuration?: number;
  videoSize?: number;
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

export interface AiToolRunRecord {
  _id?: string;
  userId: string;
  openid: string;
  toolId: AiToolId;
  outputType?: Exclude<AiToolOutputType, 'image'>;
  source: AiToolSource;
  status: AiToolRunStatus;
  inputDigest: string;
  assetIds: string[];
  title?: string;
  summary?: string;
  points?: string[];
  outputText?: string;
  outputImages?: Array<{ fileId: string; width?: number; height?: number }>;
  usage?: AiToolUsageView;
  modelProvider?: string;
  modelName?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AiToolAssetRecord {
  _id?: string;
  userId: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileKind: 'text' | 'document' | 'image';
  size: number;
  extractedText?: string;
  createdAt: number;
}

export interface AiToolUsageDailyRecord {
  _id?: string;
  userId: string;
  date: string;
  freeUsed: number;
  adUnlocked: number;
  memberUsed: number;
  updatedAt: number;
}

export interface AiToolTemplateRecord {
  _id?: string;
  toolId: AiToolId;
  title: string;
  prompt: string;
  outputType: Exclude<AiToolOutputType, 'image'>;
  sort: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PlanView {
  pid?: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  price: number;
  durationDays: number;
  description?: string;
  complianceDisplay?: MemberPlanRecord['complianceDisplay'];
}

export interface ProductTypeView {
  productCode: string;
  productName: string;
  label: string;
  tag: string;
  avatarUrl?: string;
  detailPageUrl?: string;
  available: boolean;
  description: string;
  introHighlights: Array<{
    title: string;
    description: string;
  }>;
  complianceEnabled?: boolean;
  complianceDisplay?: ProductTypeRecord['complianceDisplay'];
}

export interface AppStoreCountryView {
  countryCode: string;
  countryName: string;
  dialingCode: string;
  available: boolean;
}

export interface AiNewsView {
  id: string;
  title: string;
  summary: string;
  coverFileId?: string;
  mediaType?: AiNewsRecord['mediaType'];
  videoFileId?: string;
  videoPosterFileId?: string;
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
  videoSourceUrl?: string;
  videoDuration?: number;
  videoSize?: number;
}

export interface MembershipView {
  status: MembershipStatus;
  openStatusLabel?: '立即开通' | '开通中' | '已开通';
  productCode?: string;
  productName?: string;
  planCode?: string;
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
