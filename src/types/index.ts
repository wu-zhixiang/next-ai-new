export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'none';
export type ExpireTag = 'normal' | 'within_30d' | 'within_7d' | 'within_3d' | 'expired';

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
  planName?: string;
  startAt?: number;
  endAt?: number;
  remainDays?: number;
}

export interface AiAccountView {
  registered: boolean;
  email?: string;
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
