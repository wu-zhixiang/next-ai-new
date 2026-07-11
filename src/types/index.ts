export type MembershipStatus = 'opening' | 'active' | 'expired' | 'cancelled' | 'none';
export type ExpireTag = 'normal' | 'within_30d' | 'within_7d' | 'within_3d' | 'expired';
export type InvoiceStatus = 'submitted' | 'processing' | 'issued' | 'failed' | 'rejected';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
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

export interface PlanView {
  pid?: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  price: number;
  totalAiPoints?: number;
  durationDays: number;
  description?: string;
  complianceEnabled?: boolean;
  complianceDisplay?: {
    productName: string;
    planName: string;
    description?: string;
  };
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
  mediaType?: 'article' | 'video';
  videoFileId?: string;
  videoPosterFileId?: string;
  sourceName: string;
  sourceUrl?: string;
  authorName?: string;
  sourcePlatform: 'x' | 'blog' | 'official' | 'manual';
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

export interface InvoiceOrderView {
  orderNo: string;
  productCode: string;
  productName: string;
  planCode: string;
  planName: string;
  amount: number;
  paidAt?: number;
  fulfilledAt?: number;
}

export interface InvoiceProfileView {
  titleType: 'personal' | 'company';
  title: string;
  taxNo?: string;
  email: string;
}

export interface InvoiceRequestView {
  invoiceNo: string;
  scene?: 'WITH_WECHATPAY' | 'WITHOUT_WECHATPAY';
  fapiaoApplyId?: string;
  fapiaoId?: string;
  wechatTransactionId?: string;
  orderNos: string[];
  orders: InvoiceOrderView[];
  amount: number;
  titleType: 'personal' | 'company';
  title: string;
  taxNo?: string;
  email: string;
  status: InvoiceStatus;
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
  issuedAt?: number;
  createdAt: number;
  updatedAt: number;
}
