export type UserStatus = 'active' | 'disabled';
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'closed';
export type NewsStatus = 'draft' | 'published' | 'archived';
export type ToolStatus = 'enabled' | 'disabled' | 'testing';
export type ProductStatus = 'on' | 'off';
export type AiToolCategory = 'text' | 'image' | 'video' | 'workflow';
export type AiToolOutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments';
export type AiToolCaseMode = 'compare' | 'preview';
export type AdminFileUsage = 'icon' | 'image' | 'document' | 'other';

export interface ProductIntroHighlight {
  readonly title: string;
  readonly description: string;
}

export interface ProductComplianceDisplay {
  readonly productName: string;
  readonly label: string;
  readonly tag: string;
  readonly avatarUrl?: string;
  readonly detailPageUrl?: string;
  readonly description: string;
  readonly introHighlights?: readonly ProductIntroHighlight[];
}

export interface PlanComplianceDisplay {
  readonly productName: string;
  readonly planName: string;
  readonly description?: string;
}

export interface InviteMilestoneConfig {
  readonly id: string;
  readonly inviteCount: number;
  readonly rewardPoints: number;
  readonly enabled: boolean;
  readonly description?: string;
}

export interface PointsConfigRecord {
  readonly pointsPerYuan: number;
  readonly inviteBaseRewardPoints: number;
  readonly inviteMilestones: readonly InviteMilestoneConfig[];
  readonly updatedAt: string;
}

export interface AdminFileRecord {
  readonly id: string;
  readonly fileId: string;
  readonly url: string;
  readonly tempUrl: string;
  readonly publicUrl: string;
  readonly cloudPath: string;
  readonly name: string;
  readonly displayName: string;
  readonly usage: AdminFileUsage;
  readonly note: string;
  readonly size: number;
  readonly mimeType: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ChunkUploadProgress {
  readonly uploadId: string;
  readonly received: number;
  readonly chunkCount: number;
  readonly done: boolean;
}

export interface AiToolIntroHighlight {
  readonly title: string;
  readonly desc: string;
}

export interface AiToolCompareCase {
  readonly mode: 'compare';
  readonly title: string;
  readonly before: string;
  readonly after: string;
  readonly beforeImageFileId?: string;
  readonly afterImageFileId?: string;
}

export interface AiToolPreviewCase {
  readonly mode: 'preview';
  readonly title: string;
  readonly previewImageFileId: string;
  readonly previewDescription?: string;
}

export type AiToolIntroCase = AiToolCompareCase | AiToolPreviewCase;

export interface AiToolIntroConfig {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly highlights: readonly AiToolIntroHighlight[];
  readonly cases: readonly AiToolIntroCase[];
  readonly tips?: readonly string[];
}

export interface UserRecord {
  readonly id: string;
  readonly nickname: string;
  readonly mobileMasked: string;
  readonly membership: string;
  readonly points: number;
  readonly status: UserStatus;
  readonly createdAt: string;
  readonly lastActiveAt: string;
}

export interface OrderRecord {
  readonly id: string;
  readonly orderNo: string;
  readonly userName: string;
  readonly productName: string;
  readonly amountCents: number;
  readonly status: OrderStatus;
  readonly paidAt: string;
  readonly fulfillmentStatus: string;
}

export interface AiNewsRecord {
  readonly id: string;
  readonly title: string;
  readonly sourceName: string;
  readonly status: NewsStatus;
  readonly viewCount: number;
  readonly publishAt: string;
  readonly summary: string;
}

export interface AiToolRecord {
  readonly id: string;
  readonly toolId: string;
  readonly name: string;
  readonly category: AiToolCategory;
  readonly status: ToolStatus;
  readonly runCount: number;
  readonly pointCost: number;
  readonly trialLimit: number;
  readonly updatedAt: string;
  readonly builtIn: boolean;
  readonly cardTitle: string;
  readonly cardDescription: string;
  readonly cardBadge: string;
  readonly tags: readonly string[];
  readonly icon: string;
  readonly iconImageFileId: string;
  readonly visible: boolean;
  readonly sortOrder: number;
  readonly outputType: AiToolOutputType;
  readonly workerModel?: string;
  readonly intro?: AiToolIntroConfig;
}

export interface ProductTypeRecord {
  readonly id: string;
  readonly productCode: string;
  readonly productName: string;
  readonly label: string;
  readonly tag: string;
  readonly avatarUrl: string;
  readonly detailPageUrl: string;
  readonly available: boolean;
  readonly description: string;
  readonly introHighlights: readonly ProductIntroHighlight[];
  readonly complianceEnabled: boolean;
  readonly complianceDisplay?: ProductComplianceDisplay;
  readonly sort: number;
  readonly status: ProductStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemberPlanRecord {
  readonly id: string;
  readonly pid: string;
  readonly productCode: string;
  readonly productName: string;
  readonly planCode: string;
  readonly planName: string;
  readonly virtualPaymentProductId: string;
  readonly price: number;
  readonly totalAiPoints: number;
  readonly durationDays: number;
  readonly autoRenewEnabled: boolean;
  readonly complianceEnabled: boolean;
  readonly status: ProductStatus;
  readonly sort: number;
  readonly description: string;
  readonly complianceDisplay?: PlanComplianceDisplay;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DashboardMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface DashboardData {
  readonly metrics: readonly DashboardMetric[];
  readonly recentOrders: readonly OrderRecord[];
  readonly recentNews: readonly AiNewsRecord[];
}

export type UserUpdateInput = Pick<UserRecord, 'nickname' | 'points' | 'status'>;
export type OrderUpdateInput = Pick<OrderRecord, 'productName' | 'amountCents' | 'status' | 'fulfillmentStatus'>;
export type AiNewsInput = Pick<AiNewsRecord, 'title' | 'sourceName' | 'status' | 'publishAt' | 'summary'>;
export type ProductTypeInput = Pick<
  ProductTypeRecord,
  | 'productCode'
  | 'productName'
  | 'label'
  | 'tag'
  | 'avatarUrl'
  | 'detailPageUrl'
  | 'available'
  | 'description'
  | 'introHighlights'
  | 'complianceEnabled'
  | 'complianceDisplay'
  | 'sort'
  | 'status'
>;
export type MemberPlanInput = Pick<
  MemberPlanRecord,
  | 'productCode'
  | 'productName'
  | 'planCode'
  | 'planName'
  | 'virtualPaymentProductId'
  | 'price'
  | 'totalAiPoints'
  | 'durationDays'
  | 'autoRenewEnabled'
  | 'complianceEnabled'
  | 'status'
  | 'sort'
  | 'description'
  | 'complianceDisplay'
>;
export type AiToolInput = Pick<
  AiToolRecord,
  | 'name'
  | 'category'
  | 'status'
  | 'pointCost'
  | 'trialLimit'
  | 'cardTitle'
  | 'cardDescription'
  | 'cardBadge'
  | 'tags'
  | 'icon'
  | 'iconImageFileId'
  | 'visible'
  | 'sortOrder'
  | 'outputType'
  | 'workerModel'
  | 'intro'
>;

export type PointsConfigInput = Pick<
  PointsConfigRecord,
  'pointsPerYuan' | 'inviteBaseRewardPoints' | 'inviteMilestones'
>;

export type AdminFileInput = Pick<AdminFileRecord, 'displayName' | 'usage' | 'note'>;

export interface UploadToolImageResult {
  readonly fileId: string;
}

export type UploadToolImageChunkResult = ChunkUploadProgress & {
  readonly fileId?: string;
};

export type UploadFileResult = AdminFileRecord;

export type UploadFileChunkResult = Partial<AdminFileRecord> & ChunkUploadProgress;
