import { COLLECTIONS } from '../shared/constants';
import { app, collection, ensureCollection } from '../shared/db';
import {
  ADMIN_VISIBLE_DEFAULT_TOOL_IDS,
  buildDefaultAiToolRecord,
  getDefaultAdminToolDefinitions,
  normalizeAiToolIntroConfig,
  normalizeAiToolSortOrder,
  normalizeAiToolTags,
  normalizeAiToolWorkerModel,
  normalizeToolConfigCategory,
  normalizeToolConfigStatus,
  sanitizeAiToolConfigText,
  type AiToolConfigCategory,
  type AiToolConfigRecord,
  type AiToolConfigStatus,
  type AiToolIntroConfig,
  type AiToolTextOutputType,
} from '../shared/ai-tool-config';
import {
  POINTS_CONFIG_ID,
  getPointsConfig,
  normalizePointsConfigRecord,
} from '../shared/points-config';
import { normalizePaymentType, type PaymentType } from '../shared/payment-config';
import type {
  AiNewsRecord,
  AiToolRunRecord,
  AdminFileRecord,
  AdminFileUsage,
  PointsConfigRecord,
  MemberPlanRecord,
  MembershipRecord,
  OrderRecord as CloudOrderRecord,
  ProductTypeRecord,
  UserRecord as CloudUserRecord,
} from '../shared/types';

type ResourceName = 'users' | 'orders' | 'news' | 'tools' | 'product-types' | 'plans' | 'files';
type AdminUserStatus = 'active' | 'disabled';
type AdminOrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'closed';
type AdminNewsStatus = 'draft' | 'published' | 'archived';
type AdminToolStatus = AiToolConfigStatus;
type AdminToolCategory = AiToolConfigCategory;
type AdminConfigStatus = 'on' | 'off';

interface Event {
  httpMethod?: string;
  method?: string;
  path?: string;
  rawPath?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

interface AdminCollection {
  get(): Promise<{ data: unknown[] }>;
  where(query: Record<string, unknown>): {
    get(): Promise<{ data: unknown[] }>;
    limit(count: number): {
      get(): Promise<{ data: unknown[] }>;
    };
  };
  doc(id: string): {
    get(): Promise<{ data: unknown }>;
    set(payload: { data: unknown }): Promise<unknown>;
    update(payload: { data: unknown }): Promise<unknown>;
    remove(): Promise<unknown>;
  };
  add(payload: { data: unknown }): Promise<{ _id: string }>;
}

interface AdminUserView {
  readonly id: string;
  readonly nickname: string;
  readonly mobileMasked: string;
  readonly membership: string;
  readonly points: number;
  readonly status: AdminUserStatus;
  readonly createdAt: string;
  readonly lastActiveAt: string;
}

interface AdminOrderView {
  readonly id: string;
  readonly orderNo: string;
  readonly userName: string;
  readonly productName: string;
  readonly amountCents: number;
  readonly status: AdminOrderStatus;
  readonly paidAt: string;
  readonly fulfillmentStatus: string;
}

interface AdminNewsView {
  readonly id: string;
  readonly title: string;
  readonly sourceName: string;
  readonly status: AdminNewsStatus;
  readonly viewCount: number;
  readonly publishAt: string;
  readonly summary: string;
}

type AdminToolRecord = AiToolConfigRecord;

interface AdminToolView {
  readonly id: string;
  readonly toolId: string;
  readonly name: string;
  readonly category: AdminToolCategory;
  readonly status: AdminToolStatus;
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
  readonly outputType: AiToolTextOutputType;
  readonly workerModel?: string;
  readonly intro?: AiToolIntroConfig;
}

interface AdminProductTypeView {
  readonly id: string;
  readonly productCode: string;
  readonly productName: string;
  readonly label: string;
  readonly tag: string;
  readonly avatarUrl: string;
  readonly detailPageUrl: string;
  readonly available: boolean;
  readonly description: string;
  readonly introHighlights: NonNullable<ProductTypeRecord['introHighlights']>;
  readonly complianceEnabled: boolean;
  readonly complianceDisplay?: ProductTypeRecord['complianceDisplay'];
  readonly fulfillmentMode: NonNullable<ProductTypeRecord['fulfillmentMode']>;
  readonly sort: number;
  readonly status: AdminConfigStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AdminMemberPlanView {
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
  readonly status: AdminConfigStatus;
  readonly sort: number;
  readonly description: string;
  readonly complianceDisplay?: MemberPlanRecord['complianceDisplay'];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AdminPointsConfigView {
  readonly pointsPerYuan: number;
  readonly inviteBaseRewardPoints: number;
  readonly inviteMilestones: PointsConfigRecord['inviteMilestones'];
  readonly updatedAt: string;
}

interface AdminAppConfigView {
  readonly enableHomeAuthModal: boolean;
  readonly enableProductComplianceMode: boolean;
  readonly paymentType: PaymentType;
  readonly updatedAt: string;
}

interface AdminFileView {
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

interface DashboardPayload {
  readonly metrics: readonly {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly detail: string;
  }[];
  readonly recentOrders: readonly AdminOrderView[];
  readonly recentNews: readonly AdminNewsView[];
}

interface ToolImageFile {
  readonly extension: string;
  readonly bytes: Buffer;
}

interface AdminUploadFile {
  readonly name: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly bytes: Buffer;
}

interface AdminUploadChunkRecord {
  readonly uploadId: string;
  readonly scope: 'file' | 'toolAsset';
  readonly chunkIndex: number;
  readonly chunkCount: number;
  readonly fileName: string;
  readonly mimeType: string;
  readonly totalSize: number;
  readonly chunkData: string;
  readonly createdAt: number;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];
const ADMIN_VISIBLE_DEFAULT_TOOL_ID_SET = new Set<string>(ADMIN_VISIBLE_DEFAULT_TOOL_IDS);
const MAX_TOOL_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_ADMIN_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ADMIN_UPLOAD_CHUNK_COUNT = 240;
const ADMIN_UPLOAD_TEMP_URL_MAX_AGE = 365 * 24 * 60 * 60;

function getAllowedOrigins(): readonly string[] {
  const configured = process.env.ADMIN_ALLOWED_ORIGINS;
  if (!configured) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function buildCorsHeaders(event: Event): Record<string, string> {
  const origin = getHeader(event, 'origin');
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '';
  return {
    ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  };
}

function jsonResponse(event: Event, statusCode: number, payload: unknown): HttpResponse {
  return {
    statusCode,
    headers: buildCorsHeaders(event),
    body: JSON.stringify(payload),
  };
}

function ok<T>(event: Event, data: T): HttpResponse {
  return jsonResponse(event, 200, { code: 0, message: 'ok', data });
}

function fail(event: Event, statusCode: number, message: string): HttpResponse {
  return jsonResponse(event, statusCode, { code: statusCode, message, data: null });
}

function getHeader(event: Event, name: string): string {
  const headers = event.headers ?? {};
  const target = name.toLowerCase();
  const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return matched?.[1] ?? '';
}

function getMethod(event: Event): string {
  return (event.httpMethod ?? event.method ?? 'POST').toUpperCase();
}

function getPath(event: Event): string {
  const rawPath = event.rawPath ?? event.path ?? '';
  return rawPath.replace(/\/$/, '');
}

function parseBody(event: Event): Record<string, unknown> {
  if (!event.body) {
    return {};
  }
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function assertAdminToken(event: Event): void {
  const expected = process.env.ADMIN_API_TOKEN || process.env.OPERATOR_API_TOKEN;
  if (!expected || expected.length < 16) {
    throw withStatus(new Error('缺少后台接口密钥配置：ADMIN_API_TOKEN'), 500);
  }

  const authorization = getHeader(event, 'authorization');
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (token !== expected) {
    throw withStatus(new Error('后台密钥不正确'), 401);
  }
}

function withStatus(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}

function adminCollection(name: keyof typeof COLLECTIONS): AdminCollection {
  return collection(name) as unknown as AdminCollection;
}

async function readCollection<T>(name: keyof typeof COLLECTIONS): Promise<Array<T & { _id: string }>> {
  const result = await adminCollection(name).get();
  return result.data as Array<T & { _id: string }>;
}

function toIsoTime(value?: number): string {
  const timestamp = Number.isFinite(value) && value ? value : Date.now();
  return new Date(timestamp).toISOString();
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function sanitizePrice(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Number(numeric.toFixed(2))) : 0;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }
  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }
  return fallback;
}

function normalizeFulfillmentMode(value: unknown, fallback: NonNullable<ProductTypeRecord['fulfillmentMode']> = 'immediate'): NonNullable<ProductTypeRecord['fulfillmentMode']> {
  return value === 'manual' || value === 'immediate' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeConfigStatus(value: unknown): AdminConfigStatus {
  return value === 'on' ? 'on' : 'off';
}

function normalizeSort(value: unknown, fallback = 999): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function createConfigCode(value: string, prefix: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug ? `${prefix}_${slug}` : `${prefix}_${Date.now()}`;
}

function generatePlanPid(productCode: string, planCode: string): string {
  return `${productCode}_${planCode}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function normalizeIntroHighlights(value: unknown): NonNullable<ProductTypeRecord['introHighlights']> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const title = sanitizeText(item.title, 40);
      const description = sanitizeText(item.description, 160);
      return title || description ? { title, description } : null;
    })
    .filter((item): item is { title: string; description: string } => Boolean(item))
    .slice(0, 8);
}

function normalizeProductComplianceDisplay(value: unknown): ProductTypeRecord['complianceDisplay'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const productName = sanitizeText(value.productName, 60);
  const label = sanitizeText(value.label, 40);
  const tag = sanitizeText(value.tag, 40);
  const avatarUrl = sanitizeText(value.avatarUrl, 500);
  const detailPageUrl = sanitizeText(value.detailPageUrl, 200);
  const description = sanitizeText(value.description, 240);
  const introHighlights = normalizeIntroHighlights(value.introHighlights);
  if (!productName && !label && !tag && !avatarUrl && !detailPageUrl && !description && introHighlights.length === 0) {
    return undefined;
  }
  return {
    productName,
    label,
    tag,
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(detailPageUrl ? { detailPageUrl } : {}),
    description,
    ...(introHighlights.length ? { introHighlights } : {}),
  };
}

function normalizePlanComplianceDisplay(value: unknown): MemberPlanRecord['complianceDisplay'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const productName = sanitizeText(value.productName, 60);
  const planName = sanitizeText(value.planName, 60);
  const description = sanitizeText(value.description, 240);
  if (!productName && !planName && !description) {
    return undefined;
  }
  return {
    productName,
    planName,
    ...(description ? { description } : {}),
  };
}

function requirePlanComplianceDisplay(value: unknown): MemberPlanRecord['complianceDisplay'] {
  const display = normalizePlanComplianceDisplay(value);
  if (!display?.productName || !display.planName || !display.description) {
    throw withStatus(new Error('启用合规展示后，请填写合规商品名、合规套餐名和合规说明'), 422);
  }
  return display;
}

function maskMobile(value: string): string {
  const mobile = value.trim();
  if (mobile.length < 7) {
    return mobile;
  }
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

function matchRoute(path: string): { resource?: ResourceName; id?: string } {
  const normalized = path.replace(/^\/admin-api/, '');
  if (normalized === '/dashboard') {
    return {};
  }
  const matched = normalized.match(/^\/(users|orders|news|tools|product-types|plans|files)(?:\/([^/]+))?$/);
  if (!matched?.[1]) {
    return {};
  }
  return {
    resource: matched[1] as ResourceName,
    id: matched[2] ? decodeURIComponent(matched[2]) : undefined,
  };
}

function getUserMembership(userId: string, memberships: readonly (MembershipRecord & { _id: string })[]): string {
  const userMemberships = memberships
    .filter((membership) => membership.userId === userId)
    .sort((left, right) => right.endAt - left.endAt);
  const active = userMemberships.find((membership) => membership.status === 'active');
  const fallback = userMemberships[0];
  const target = active ?? fallback;
  if (!target) {
    return '无会员';
  }
  return target.planName || target.productName || '会员';
}

function toUserView(
  user: CloudUserRecord & { _id: string },
  memberships: readonly (MembershipRecord & { _id: string })[],
): AdminUserView {
  return {
    id: user._id,
    nickname: user.nickname || '微信用户',
    mobileMasked: maskMobile(user.mobile || ''),
    membership: getUserMembership(user._id, memberships),
    points: Number(user.pointsBalance ?? 0),
    status: user.status,
    createdAt: toIsoTime(user.createdAt),
    lastActiveAt: toIsoTime(user.lastLoginAt ?? user.updatedAt),
  };
}

function orderStatusFromRecord(order: CloudOrderRecord): AdminOrderStatus {
  if (order.payStatus === 'paid' && order.fulfillmentStatus === 'fulfilled') {
    return 'fulfilled';
  }
  if (order.payStatus === 'paid') {
    return 'paid';
  }
  if (order.payStatus === 'refunded') {
    return 'refunded';
  }
  if (order.payStatus === 'closed') {
    return 'closed';
  }
  return 'pending';
}

function getOrderUserName(order: CloudOrderRecord, userMap: ReadonlyMap<string, CloudUserRecord & { _id: string }>): string {
  const user = userMap.get(order.userId);
  return user?.nickname || (user?.mobile ? maskMobile(user.mobile) : order.userId);
}

function toOrderView(
  order: CloudOrderRecord & { _id: string },
  userMap: ReadonlyMap<string, CloudUserRecord & { _id: string }>,
): AdminOrderView {
  return {
    id: order._id,
    orderNo: order.orderNo,
    userName: getOrderUserName(order, userMap),
    productName: order.planName || order.productName,
    amountCents: Number(order.amount ?? 0),
    status: orderStatusFromRecord(order),
    paidAt: toIsoTime(order.paidAt ?? order.createdAt),
    fulfillmentStatus: order.fulfillmentStatus ?? 'pending',
  };
}

function toNewsView(record: AiNewsRecord & { _id: string }): AdminNewsView {
  return {
    id: record._id,
    title: record.title,
    sourceName: record.sourceName,
    status: record.status,
    viewCount: Number(record.viewCount ?? 0),
    publishAt: toIsoTime(record.publishedAt),
    summary: record.summary,
  };
}

function normalizeToolCategory(value: unknown): AdminToolCategory {
  return normalizeToolConfigCategory(value);
}

function normalizeToolStatus(value: unknown): AdminToolStatus {
  return normalizeToolConfigStatus(value);
}

function findToolRecord(
  records: readonly (AdminToolRecord & { _id: string })[],
  id: string,
): (AdminToolRecord & { _id: string }) | undefined {
  return records.find((record) => record._id === id || record.toolId === id);
}

function isBuiltInAdminTool(toolId: string): boolean {
  return ADMIN_VISIBLE_DEFAULT_TOOL_ID_SET.has(toolId);
}

function mergeDefaultToolRecord(
  definition: ReturnType<typeof getDefaultAdminToolDefinitions>[number],
  override?: AdminToolRecord & { _id: string },
): AdminToolRecord & { _id: string } | undefined {
  if (override?.deleted) {
    return undefined;
  }
  const base = buildDefaultAiToolRecord(definition);
  if (!override) {
    return base;
  }
  return {
    ...base,
    ...override,
    _id: override._id,
    toolId: definition.toolId,
    builtIn: true,
    runCount: Number(override.runCount ?? base.runCount),
    tags: normalizeAiToolTags(override.tags, base.tags ?? []),
    sortOrder: normalizeAiToolSortOrder(override.sortOrder, base.sortOrder ?? 999),
    createdAt: Number(override.createdAt ?? base.createdAt),
    updatedAt: Number(override.updatedAt ?? base.updatedAt),
  };
}

function mergeToolRecords(records: readonly (AdminToolRecord & { _id: string })[]): Array<AdminToolRecord & { _id: string }> {
  const recordsByToolId = new Map<string, AdminToolRecord & { _id: string }>();
  for (const record of records) {
    const key = record.toolId ?? (isBuiltInAdminTool(record._id) ? record._id : '');
    if (key) {
      recordsByToolId.set(key, record);
    }
  }

  const builtInRecords = getDefaultAdminToolDefinitions()
    .map((definition) => mergeDefaultToolRecord(definition, recordsByToolId.get(definition.toolId)))
    .filter((record): record is AdminToolRecord & { _id: string } => Boolean(record));

  const customRecords = records
    .filter((record) => !record.deleted)
    .filter((record) => !isBuiltInAdminTool(record.toolId ?? record._id))
    .map((record) => ({
      ...record,
      toolId: record.toolId ?? record._id,
      builtIn: Boolean(record.builtIn),
    }));

  return [...builtInRecords, ...customRecords];
}

async function getToolRunCounts(): Promise<ReadonlyMap<string, number>> {
  try {
    await ensureCollection('aiToolRuns');
    const records = await readCollection<AiToolRunRecord>('aiToolRuns');
    const counts = new Map<string, number>();
    for (const record of records) {
      counts.set(record.toolId, (counts.get(record.toolId) ?? 0) + 1);
    }
    return counts;
  } catch {
    return new Map<string, number>();
  }
}

function getWritableToolRecord(record: AdminToolRecord): AdminToolRecord {
  const { _id: _documentId, ...data } = record;
  return data;
}

function createCustomToolId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return slug ? `custom_${slug}` : `custom_${Date.now()}`;
}

function getExtensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  const map: Record<string, string> = {
    'application/json': 'json',
    'application/pdf': 'pdf',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'text/csv': 'csv',
    'text/html': 'html',
    'text/markdown': 'md',
    'text/plain': 'txt',
  };
  return map[normalized] ?? 'bin';
}

function getExtensionFromFileName(fileName: string): string {
  const extension = fileName.split('?')[0]?.split('#')[0]?.match(/\.([a-z0-9]{1,16})$/i)?.[1];
  return extension ? extension.toLowerCase() : '';
}

function sanitizeUploadFileName(value: unknown, fallbackExtension: string): string {
  const rawName = sanitizeText(value, 160);
  const fallbackName = `upload.${fallbackExtension || 'bin'}`;
  return rawName || fallbackName;
}

function sanitizeCloudPathSegment(value: string): string {
  const normalized = value
    .replace(/\.[a-z0-9]{1,16}$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'file';
}

function parseAdminUploadDataUrl(body: Record<string, unknown>): AdminUploadFile {
  const dataUrl = body.dataUrl;
  if (typeof dataUrl !== 'string') {
    throw withStatus(new Error('缺少上传文件'), 422);
  }
  const matched = dataUrl.match(/^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/);
  if (!matched || !matched[2]) {
    throw withStatus(new Error('上传文件格式不正确'), 422);
  }
  const mimeType = (matched[1] || 'application/octet-stream').toLowerCase();
  const extensionFromMime = getExtensionFromMimeType(mimeType);
  const name = sanitizeUploadFileName(body.fileName, extensionFromMime);
  const extension = getExtensionFromFileName(name) || extensionFromMime;
  const bytes = Buffer.from(matched[2], 'base64');
  if (bytes.length === 0) {
    throw withStatus(new Error('上传文件为空'), 422);
  }
  if (bytes.length > MAX_ADMIN_UPLOAD_FILE_BYTES) {
    throw withStatus(new Error('文件不能超过 10MB'), 422);
  }
  return {
    name,
    extension,
    mimeType,
    bytes,
  };
}

function parseToolImageDataUrl(value: unknown): ToolImageFile {
  if (typeof value !== 'string') {
    throw withStatus(new Error('缺少图片文件'), 422);
  }
  const matched = value.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!matched?.[1] || !matched[2]) {
    throw withStatus(new Error('图片仅支持 PNG/JPG/WebP'), 422);
  }
  const extension = matched[1].startsWith('jp') ? 'jpg' : matched[1];
  const bytes = Buffer.from(matched[2], 'base64');
  if (bytes.length === 0) {
    throw withStatus(new Error('图片文件为空'), 422);
  }
  if (bytes.length > MAX_TOOL_IMAGE_BYTES) {
    throw withStatus(new Error('图片不能超过 3MB'), 422);
  }
  return { extension, bytes };
}

function sanitizeUploadId(value: unknown): string {
  const uploadId = sanitizeText(value, 80);
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) {
    throw withStatus(new Error('上传会话无效'), 422);
  }
  return uploadId;
}

function parseUploadChunkBody(body: Record<string, unknown>, scope: 'file' | 'toolAsset'): AdminUploadChunkRecord {
  const uploadId = sanitizeUploadId(body.uploadId);
  const chunkIndex = Math.floor(Number(body.chunkIndex));
  const chunkCount = Math.floor(Number(body.chunkCount));
  const totalSize = Math.floor(Number(body.totalSize));
  const mimeType = sanitizeText(body.mimeType, 120).toLowerCase() || 'application/octet-stream';
  const fallbackExtension = getExtensionFromMimeType(mimeType);
  const fileName = sanitizeUploadFileName(body.fileName, fallbackExtension);
  const chunkData = typeof body.chunkData === 'string' ? body.chunkData.trim() : '';
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    throw withStatus(new Error('上传分片序号无效'), 422);
  }
  if (!Number.isFinite(chunkCount) || chunkCount < 1 || chunkCount > MAX_ADMIN_UPLOAD_CHUNK_COUNT || chunkIndex >= chunkCount) {
    throw withStatus(new Error('上传分片数量无效'), 422);
  }
  if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_ADMIN_UPLOAD_FILE_BYTES) {
    throw withStatus(new Error('文件不能超过 10MB'), 422);
  }
  if (scope === 'toolAsset') {
    if (!/^image\/(?:png|jpe?g|webp)$/.test(mimeType)) {
      throw withStatus(new Error('图片仅支持 PNG/JPG/WebP'), 422);
    }
    if (totalSize > MAX_TOOL_IMAGE_BYTES) {
      throw withStatus(new Error('图片不能超过 3MB'), 422);
    }
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(chunkData)) {
    throw withStatus(new Error('上传分片格式不正确'), 422);
  }
  const chunkBytes = Buffer.from(chunkData, 'base64');
  if (chunkBytes.length === 0 || chunkBytes.length > 512 * 1024) {
    throw withStatus(new Error('上传分片大小无效'), 422);
  }
  return {
    uploadId,
    scope,
    chunkIndex,
    chunkCount,
    fileName,
    mimeType,
    totalSize,
    chunkData,
    createdAt: Date.now(),
  };
}

async function saveUploadChunk(record: AdminUploadChunkRecord): Promise<void> {
  await ensureCollection('adminUploadChunks');
  const existing = await adminCollection('adminUploadChunks')
    .where({
      uploadId: record.uploadId,
      scope: record.scope,
      chunkIndex: record.chunkIndex,
    })
    .limit(1)
    .get();
  const current = existing.data[0] as { _id?: string } | undefined;
  if (current?._id) {
    await adminCollection('adminUploadChunks').doc(current._id).update({ data: record });
    return;
  }
  await adminCollection('adminUploadChunks').add({ data: record });
}

async function readUploadChunks(uploadId: string, scope: 'file' | 'toolAsset'): Promise<Array<AdminUploadChunkRecord & { _id: string }>> {
  await ensureCollection('adminUploadChunks');
  const result = await adminCollection('adminUploadChunks').where({ uploadId, scope }).get();
  return (result.data as Array<AdminUploadChunkRecord & { _id?: string }>)
    .filter((record): record is AdminUploadChunkRecord & { _id: string } => Boolean(record._id))
    .sort((left, right) => left.chunkIndex - right.chunkIndex);
}

async function deleteUploadChunks(records: ReadonlyArray<AdminUploadChunkRecord & { _id: string }>): Promise<void> {
  await Promise.all(records.map((record) => adminCollection('adminUploadChunks').doc(record._id).remove()));
}

function assembleUploadChunks(records: ReadonlyArray<AdminUploadChunkRecord>, expected: AdminUploadChunkRecord): Buffer {
  if (records.length !== expected.chunkCount) {
    throw withStatus(new Error('上传分片未完成'), 202);
  }
  const seen = new Set<number>();
  for (const record of records) {
    if (record.chunkCount !== expected.chunkCount || record.totalSize !== expected.totalSize || record.mimeType !== expected.mimeType) {
      throw withStatus(new Error('上传分片信息不一致'), 422);
    }
    seen.add(record.chunkIndex);
  }
  for (let index = 0; index < expected.chunkCount; index += 1) {
    if (!seen.has(index)) {
      throw withStatus(new Error('上传分片未完成'), 202);
    }
  }
  const bytes = Buffer.concat(records.map((record) => Buffer.from(record.chunkData, 'base64')));
  if (bytes.length !== expected.totalSize) {
    throw withStatus(new Error('上传文件大小不一致'), 422);
  }
  return bytes;
}

function toPublicFileUrl(tempUrl: string): string {
  return tempUrl.split('?')[0] ?? '';
}

function normalizeAdminFileUsage(value: unknown): AdminFileUsage {
  if (value === 'icon' || value === 'image' || value === 'document' || value === 'other') {
    return value;
  }
  return 'icon';
}

function normalizeAdminFileDisplayName(value: unknown, fallback: string): string {
  return sanitizeText(value, 120) || fallback;
}

function normalizeAdminFileNote(value: unknown): string {
  return sanitizeText(value, 240);
}

async function getFileUrls(fileId: string): Promise<{ readonly tempUrl: string; readonly publicUrl: string }> {
  try {
    const result = await app.getTempFileURL({
      fileList: [{ fileID: fileId, maxAge: ADMIN_UPLOAD_TEMP_URL_MAX_AGE }],
    });
    const tempUrl = result.fileList[0]?.tempFileURL ?? '';
    return {
      tempUrl,
      publicUrl: toPublicFileUrl(tempUrl),
    };
  } catch {
    return { tempUrl: '', publicUrl: '' };
  }
}

async function getFileUrlsMap(fileIds: readonly string[]): Promise<ReadonlyMap<string, { readonly tempUrl: string; readonly publicUrl: string }>> {
  const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));
  if (uniqueFileIds.length === 0) {
    return new Map();
  }
  try {
    const result = await app.getTempFileURL({
      fileList: uniqueFileIds.map((fileID) => ({ fileID, maxAge: ADMIN_UPLOAD_TEMP_URL_MAX_AGE })),
    });
    const urls = new Map<string, { readonly tempUrl: string; readonly publicUrl: string }>();
    for (const item of result.fileList) {
      const fileId = item.fileID ?? '';
      const tempUrl = item.tempFileURL ?? '';
      if (fileId) {
        urls.set(fileId, {
          tempUrl,
          publicUrl: toPublicFileUrl(tempUrl),
        });
      }
    }
    return urls;
  } catch {
    return new Map();
  }
}

function toAdminFileView(
  record: AdminFileRecord & { _id: string },
  urls: { readonly tempUrl: string; readonly publicUrl: string },
): AdminFileView {
  return {
    id: record._id,
    fileId: record.fileId,
    url: urls.tempUrl,
    tempUrl: urls.tempUrl,
    publicUrl: urls.publicUrl,
    cloudPath: record.cloudPath,
    name: record.name,
    displayName: record.displayName || record.name,
    usage: normalizeAdminFileUsage(record.usage),
    note: record.note ?? '',
    size: Number(record.size ?? 0),
    mimeType: record.mimeType || 'application/octet-stream',
    createdAt: toIsoTime(record.createdAt),
    updatedAt: toIsoTime(record.updatedAt),
  };
}

async function listAdminFiles(event: Event): Promise<HttpResponse> {
  await ensureCollection('adminFiles');
  const records = await readCollection<AdminFileRecord>('adminFiles');
  const sortedRecords = records
    .sort((left, right) => (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0))
    .slice(0, 500);
  const urls = await getFileUrlsMap(sortedRecords.map((record) => record.fileId));
  const data = sortedRecords.map((record) => toAdminFileView(record, urls.get(record.fileId) ?? { tempUrl: '', publicUrl: '' }));
  return ok(event, data);
}

async function uploadAdminFile(event: Event): Promise<HttpResponse> {
  await ensureCollection('adminFiles');
  const body = parseBody(event);
  const file = parseAdminUploadDataUrl(body);
  const now = Date.now();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const baseName = sanitizeCloudPathSegment(file.name);
  const cloudPath = `cloud-admin/uploads/${now}-${random}-${baseName}.${file.extension}`;
  const result = await app.uploadFile({
    cloudPath,
    fileContent: file.bytes,
  });
  const record: AdminFileRecord = {
    fileId: result.fileID,
    cloudPath,
    name: file.name,
    displayName: normalizeAdminFileDisplayName(body.displayName, file.name),
    usage: normalizeAdminFileUsage(body.usage),
    note: normalizeAdminFileNote(body.note),
    size: file.bytes.length,
    mimeType: file.mimeType,
    createdAt: now,
    updatedAt: now,
  };
  const created = await adminCollection('adminFiles').add({ data: record });
  const fileUrls = await getFileUrls(result.fileID);
  return ok(event, toAdminFileView({ ...record, _id: created._id }, fileUrls));
}

async function uploadAdminFileChunk(event: Event): Promise<HttpResponse> {
  await ensureCollection('adminFiles');
  const body = parseBody(event);
  const chunk = parseUploadChunkBody(body, 'file');
  await saveUploadChunk(chunk);
  const chunks = await readUploadChunks(chunk.uploadId, 'file');
  if (chunks.length < chunk.chunkCount) {
    return ok(event, {
      uploadId: chunk.uploadId,
      received: chunks.length,
      chunkCount: chunk.chunkCount,
      done: false,
    });
  }
  const bytes = assembleUploadChunks(chunks, chunk);
  const now = Date.now();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const extension = getExtensionFromFileName(chunk.fileName) || getExtensionFromMimeType(chunk.mimeType);
  const baseName = sanitizeCloudPathSegment(chunk.fileName);
  const cloudPath = `cloud-admin/uploads/${now}-${random}-${baseName}.${extension}`;
  const result = await app.uploadFile({
    cloudPath,
    fileContent: bytes,
  });
  const record: AdminFileRecord = {
    fileId: result.fileID,
    cloudPath,
    name: chunk.fileName,
    displayName: normalizeAdminFileDisplayName(body.displayName, chunk.fileName),
    usage: normalizeAdminFileUsage(body.usage),
    note: normalizeAdminFileNote(body.note),
    size: bytes.length,
    mimeType: chunk.mimeType,
    createdAt: now,
    updatedAt: now,
  };
  const created = await adminCollection('adminFiles').add({ data: record });
  await deleteUploadChunks(chunks);
  const fileUrls = await getFileUrls(result.fileID);
  return ok(event, {
    ...toAdminFileView({ ...record, _id: created._id }, fileUrls),
    uploadId: chunk.uploadId,
    received: chunks.length,
    chunkCount: chunk.chunkCount,
    done: true,
  });
}

async function updateAdminFile(event: Event, fileRecordId: string): Promise<HttpResponse> {
  await ensureCollection('adminFiles');
  const existing = await adminCollection('adminFiles').doc(fileRecordId).get()
    .then((result) => result.data as (AdminFileRecord & { _id?: string }) | undefined)
    .catch(() => undefined);
  if (!existing) {
    return fail(event, 404, '文件记录不存在');
  }
  const body = parseBody(event);
  const updatedAt = Date.now();
  const patch = {
    displayName: normalizeAdminFileDisplayName(body.displayName, existing.displayName || existing.name),
    usage: normalizeAdminFileUsage(body.usage ?? existing.usage),
    note: normalizeAdminFileNote(body.note),
    updatedAt,
  };
  await adminCollection('adminFiles').doc(fileRecordId).update({ data: patch });
  const fileUrls = await getFileUrls(existing.fileId);
  return ok(event, toAdminFileView({ ...existing, ...patch, _id: fileRecordId }, fileUrls));
}

function isMissingCloudFileMessage(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('not exist') || normalized.includes('not found') || normalized.includes('不存在');
}

async function deleteCloudFile(fileId: string): Promise<void> {
  if (!fileId) {
    return;
  }
  try {
    const result = await app.deleteFile({ fileList: [fileId] });
    const target = result.fileList[0];
    const status = target?.status ?? 0;
    const errMsg = target?.errMsg ?? '';
    if (status !== 0 && !isMissingCloudFileMessage(errMsg)) {
      throw new Error(errMsg || 'deleteFile failed');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingCloudFileMessage(message)) {
      return;
    }
    throw withStatus(new Error('删除云存储文件失败'), 500);
  }
}

async function deleteAdminFile(event: Event, fileRecordId: string): Promise<HttpResponse> {
  const body = parseBody(event);
  if (body.confirm !== 'DELETE') {
    return fail(event, 400, '删除操作缺少二次确认');
  }
  await ensureCollection('adminFiles');
  const existing = await adminCollection('adminFiles').doc(fileRecordId).get()
    .then((result) => result.data as (AdminFileRecord & { _id?: string }) | undefined)
    .catch(() => undefined);
  if (!existing) {
    return fail(event, 404, '文件记录不存在');
  }
  await deleteCloudFile(existing.fileId);
  await adminCollection('adminFiles').doc(fileRecordId).remove();
  return ok(event, { deleted: true });
}

async function uploadToolAsset(event: Event): Promise<HttpResponse> {
  const body = parseBody(event);
  const file = parseToolImageDataUrl(body.dataUrl);
  const now = Date.now();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const result = await app.uploadFile({
    cloudPath: `ai-tools/intro/${now}-${random}.${file.extension}`,
    fileContent: file.bytes,
  });
  return ok(event, { fileId: result.fileID });
}

async function uploadToolAssetChunk(event: Event): Promise<HttpResponse> {
  const body = parseBody(event);
  const chunk = parseUploadChunkBody(body, 'toolAsset');
  await saveUploadChunk(chunk);
  const chunks = await readUploadChunks(chunk.uploadId, 'toolAsset');
  if (chunks.length < chunk.chunkCount) {
    return ok(event, {
      uploadId: chunk.uploadId,
      received: chunks.length,
      chunkCount: chunk.chunkCount,
      done: false,
    });
  }
  const bytes = assembleUploadChunks(chunks, chunk);
  const extension = getExtensionFromFileName(chunk.fileName) || getExtensionFromMimeType(chunk.mimeType);
  const now = Date.now();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const result = await app.uploadFile({
    cloudPath: `ai-tools/intro/${now}-${random}.${extension}`,
    fileContent: bytes,
  });
  await deleteUploadChunks(chunks);
  return ok(event, {
    fileId: result.fileID,
    uploadId: chunk.uploadId,
    received: chunks.length,
    chunkCount: chunk.chunkCount,
    done: true,
  });
}

function normalizeToolOutputType(value: unknown, existing?: AiToolTextOutputType): AiToolTextOutputType {
  if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
    return value;
  }
  return existing ?? 'summary';
}

function toToolView(record: AdminToolRecord & { _id: string }, runCounts: ReadonlyMap<string, number>): AdminToolView {
  const toolId = record.toolId ?? record._id;
  const intro = normalizeAiToolIntroConfig(record.intro);
  return {
    id: record._id,
    toolId,
    name: record.name,
    category: normalizeToolCategory(record.category),
    status: normalizeToolStatus(record.status),
    runCount: runCounts.get(toolId) ?? Number(record.runCount ?? 0),
    pointCost: Number(record.pointCost ?? 0),
    trialLimit: Number(record.trialLimit ?? 0),
    updatedAt: toIsoTime(record.updatedAt),
    builtIn: Boolean(record.builtIn),
    cardTitle: record.cardTitle || record.name,
    cardDescription: record.cardDescription || '',
    cardBadge: normalizeAiToolTags(record.tags, [record.cardBadge || ''].filter(Boolean))[0] || (normalizeToolStatus(record.status) === 'enabled' ? '已上线' : '接入中'),
    tags: normalizeAiToolTags(record.tags, [record.cardBadge || ''].filter(Boolean)),
    icon: record.icon || 'AI',
    iconImageFileId: record.iconImageFileId || '',
    visible: record.visible !== false,
    sortOrder: normalizeAiToolSortOrder(record.sortOrder, 999),
    outputType: record.outputType ?? 'summary',
    workerModel: normalizeAiToolWorkerModel(record.workerModel),
    ...(intro ? { intro } : {}),
  };
}

function toProductTypeView(record: ProductTypeRecord & { _id: string }): AdminProductTypeView {
  const complianceEnabled = record.complianceEnabled ?? Boolean(record.complianceDisplay);
  return {
    id: record._id,
    productCode: record.productCode,
    productName: record.productName,
    label: record.label,
    tag: record.tag,
    avatarUrl: record.avatarUrl ?? '',
    detailPageUrl: record.detailPageUrl ?? '',
    available: Boolean(record.available),
    description: record.description,
    introHighlights: record.introHighlights ?? [],
    complianceEnabled,
    ...(complianceEnabled && record.complianceDisplay ? { complianceDisplay: record.complianceDisplay } : {}),
    fulfillmentMode: normalizeFulfillmentMode(record.fulfillmentMode),
    sort: normalizeSort(record.sort, 999),
    status: normalizeConfigStatus(record.status),
    createdAt: toIsoTime(record.createdAt),
    updatedAt: toIsoTime(record.updatedAt),
  };
}

function toMemberPlanView(record: MemberPlanRecord & { _id: string }): AdminMemberPlanView {
  return {
    id: record._id,
    pid: record.pid ?? generatePlanPid(record.productCode, record.planCode),
    productCode: record.productCode,
    productName: record.productName,
    planCode: record.planCode,
    planName: record.planName,
    virtualPaymentProductId: record.virtualPaymentProductId ?? '',
    price: Number(record.price ?? 0),
    totalAiPoints: Number(record.totalAiPoints ?? 0),
    durationDays: Number(record.durationDays ?? 0),
    autoRenewEnabled: Boolean(record.autoRenewEnabled),
    complianceEnabled: record.complianceEnabled ?? Boolean(record.complianceDisplay),
    status: normalizeConfigStatus(record.status),
    sort: normalizeSort(record.sort, 999),
    description: record.description ?? '',
    ...(record.complianceDisplay ? { complianceDisplay: record.complianceDisplay } : {}),
    createdAt: toIsoTime(record.createdAt),
    updatedAt: toIsoTime(record.updatedAt),
  };
}

function toPointsConfigView(record: PointsConfigRecord): AdminPointsConfigView {
  return {
    pointsPerYuan: record.pointsPerYuan,
    inviteBaseRewardPoints: record.inviteBaseRewardPoints,
    inviteMilestones: record.inviteMilestones,
    updatedAt: toIsoTime(record.updatedAt),
  };
}

function findProductTypeRecord(
  records: readonly (ProductTypeRecord & { _id: string })[],
  id: string,
): (ProductTypeRecord & { _id: string }) | undefined {
  return records.find((record) => record._id === id || record.productCode === id);
}

function findMemberPlanRecord(
  records: readonly (MemberPlanRecord & { _id: string })[],
  id: string,
): (MemberPlanRecord & { _id: string }) | undefined {
  return records.find((record) => record._id === id || record.pid === id);
}

function normalizeProductTypeInput(
  body: Record<string, unknown>,
  existing?: ProductTypeRecord,
  fallbackProductCode?: string,
): ProductTypeRecord {
  const now = Date.now();
  const productName = sanitizeText(body.productName, 60) || existing?.productName || '';
  if (!productName) {
    throw withStatus(new Error('商品名称不能为空'), 422);
  }
  const requestedCode = sanitizeText(body.productCode, 60);
  const productCode = (existing?.productCode ?? fallbackProductCode ?? requestedCode) || createConfigCode(productName, 'product');
  const complianceEnabled = sanitizeBoolean(body.complianceEnabled, existing?.complianceEnabled ?? Boolean(existing?.complianceDisplay));
  return {
    productCode,
    productName,
    label: sanitizeText(body.label, 40) || productName,
    tag: sanitizeText(body.tag, 40),
    avatarUrl: sanitizeText(body.avatarUrl, 500),
    detailPageUrl: sanitizeText(body.detailPageUrl, 200),
    available: sanitizeBoolean(body.available, existing?.available ?? false),
    description: sanitizeText(body.description, 240),
    introHighlights: normalizeIntroHighlights(body.introHighlights),
    complianceEnabled,
    complianceDisplay: complianceEnabled ? normalizeProductComplianceDisplay(body.complianceDisplay) : undefined,
    fulfillmentMode: normalizeFulfillmentMode(body.fulfillmentMode, existing?.fulfillmentMode ?? 'immediate'),
    sort: normalizeSort(body.sort, existing?.sort ?? 999),
    status: normalizeConfigStatus(body.status),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function normalizeMemberPlanInput(
  body: Record<string, unknown>,
  existing?: MemberPlanRecord,
  fallbackPid?: string,
): MemberPlanRecord {
  const now = Date.now();
  const productCode = existing?.productCode ?? sanitizeText(body.productCode, 60);
  const planCode = existing?.planCode ?? sanitizeText(body.planCode, 60);
  const productName = sanitizeText(body.productName, 60) || existing?.productName || '';
  const planName = sanitizeText(body.planName, 60) || existing?.planName || '';
  const complianceEnabled = sanitizeBoolean(body.complianceEnabled, existing?.complianceEnabled ?? Boolean(existing?.complianceDisplay));
  if (!productCode) {
    throw withStatus(new Error('商品编码不能为空'), 422);
  }
  if (!productName) {
    throw withStatus(new Error('商品名称不能为空'), 422);
  }
  if (!planCode) {
    throw withStatus(new Error('套餐编码不能为空'), 422);
  }
  if (!planName) {
    throw withStatus(new Error('套餐名称不能为空'), 422);
  }
  const pid = existing?.pid ?? fallbackPid ?? generatePlanPid(productCode, planCode);
  return {
    pid,
    productCode,
    productName,
    planCode,
    planName,
    virtualPaymentProductId: sanitizeText(body.virtualPaymentProductId, 100),
    price: sanitizePrice(body.price),
    totalAiPoints: sanitizeNumber(body.totalAiPoints),
    durationDays: sanitizeNumber(body.durationDays),
    autoRenewEnabled: sanitizeBoolean(body.autoRenewEnabled, existing?.autoRenewEnabled ?? false),
    complianceEnabled,
    status: normalizeConfigStatus(body.status),
    sort: normalizeSort(body.sort, existing?.sort ?? 999),
    description: sanitizeText(body.description, 240),
    complianceDisplay: complianceEnabled ? requirePlanComplianceDisplay(body.complianceDisplay) : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function getStoredPointsConfigRecord(): Promise<(PointsConfigRecord & { _id: string }) | undefined> {
  await ensureCollection('pointsConfig');
  const records = await readCollection<PointsConfigRecord>('pointsConfig');
  return records.find((record) => record.configId === POINTS_CONFIG_ID);
}

function normalizePointsConfigInput(
  body: Record<string, unknown>,
  existing?: PointsConfigRecord,
): PointsConfigRecord {
  const now = Date.now();
  return normalizePointsConfigRecord({
    ...body,
    configId: POINTS_CONFIG_ID,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

function normalizeAppConfigRecord(body: Record<string, unknown>): AdminAppConfigView & { updatedAtMs: number } {
  const updatedAtMs = Date.now();
  return {
    enableHomeAuthModal: sanitizeBoolean(body.enableHomeAuthModal, true),
    enableProductComplianceMode: sanitizeBoolean(body.enableProductComplianceMode, false),
    paymentType: normalizePaymentType(body.paymentType),
    updatedAt: toIsoTime(updatedAtMs),
    updatedAtMs,
  };
}

async function getStoredAppConfig(): Promise<AdminAppConfigView> {
  await ensureCollection('appConfig');
  try {
    const result = await adminCollection('appConfig').doc('client').get();
    const record = result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : {};
    const updatedAt = typeof record.updatedAt === 'number' ? toIsoTime(record.updatedAt) : '';
    return {
      enableHomeAuthModal: sanitizeBoolean(record.enableHomeAuthModal, true),
      enableProductComplianceMode: sanitizeBoolean(record.enableProductComplianceMode, false),
      paymentType: normalizePaymentType(record.paymentType),
      updatedAt,
    };
  } catch {
    return {
      enableHomeAuthModal: true,
      enableProductComplianceMode: false,
      paymentType: 'virtual',
      updatedAt: '',
    };
  }
}

async function getAdminAppConfig(event: Event): Promise<HttpResponse> {
  return ok(event, await getStoredAppConfig());
}

async function updateAdminAppConfig(event: Event): Promise<HttpResponse> {
  await ensureCollection('appConfig');
  const normalized = normalizeAppConfigRecord(parseBody(event));
  let enableNewsAuthModal = true;
  try {
    const result = await adminCollection('appConfig').doc('client').get();
    const record = result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : {};
    enableNewsAuthModal = sanitizeBoolean(record.enableNewsAuthModal, true);
  } catch {
    enableNewsAuthModal = true;
  }
  await adminCollection('appConfig').doc('client').set({
    data: {
      enableHomeAuthModal: normalized.enableHomeAuthModal,
      enableNewsAuthModal,
      enableProductComplianceMode: normalized.enableProductComplianceMode,
      paymentType: normalized.paymentType,
      updatedAt: normalized.updatedAtMs,
    },
  });
  return ok(event, {
    enableHomeAuthModal: normalized.enableHomeAuthModal,
    enableProductComplianceMode: normalized.enableProductComplianceMode,
    paymentType: normalized.paymentType,
    updatedAt: normalized.updatedAt,
  });
}

async function listUsers(event: Event): Promise<HttpResponse> {
  const [users, memberships] = await Promise.all([
    readCollection<CloudUserRecord>('users'),
    readCollection<MembershipRecord>('memberships'),
  ]);
  const data = users
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 200)
    .map((user) => toUserView(user, memberships));
  return ok(event, data);
}

async function updateUser(event: Event, userId: string): Promise<HttpResponse> {
  const body = parseBody(event);
  const status = body.status === 'disabled' ? 'disabled' : 'active';
  const points = sanitizeNumber(body.points);
  await adminCollection('users').doc(userId).update({
    data: {
      nickname: sanitizeText(body.nickname, 40),
      status,
      pointsBalance: points,
      updatedAt: Date.now(),
    },
  });
  return listUsers(event);
}

async function deleteDocument(event: Event, name: keyof typeof COLLECTIONS, id: string): Promise<HttpResponse> {
  const body = parseBody(event);
  if (body.confirm !== 'DELETE') {
    return fail(event, 400, '删除操作缺少二次确认');
  }
  await adminCollection(name).doc(id).remove();
  return ok(event, { deleted: true });
}

async function listOrders(event: Event): Promise<HttpResponse> {
  const [orders, users] = await Promise.all([
    readCollection<CloudOrderRecord>('orders'),
    readCollection<CloudUserRecord>('users'),
  ]);
  const userMap = new Map(users.map((user) => [user._id, user]));
  const data = orders
    .sort((left, right) => (right.paidAt ?? right.createdAt) - (left.paidAt ?? left.createdAt))
    .slice(0, 200)
    .map((order) => toOrderView(order, userMap));
  return ok(event, data);
}

function normalizeOrderUpdate(body: Record<string, unknown>): Partial<CloudOrderRecord> {
  const status = body.status as AdminOrderStatus | undefined;
  const update: Partial<CloudOrderRecord> = {
    productName: sanitizeText(body.productName, 60),
    planName: sanitizeText(body.productName, 60),
    amount: sanitizeNumber(body.amountCents),
    fulfillmentStatus: sanitizeText(body.fulfillmentStatus, 30) as CloudOrderRecord['fulfillmentStatus'],
    updatedAt: Date.now(),
  };
  if (status === 'pending') {
    update.payStatus = 'pending';
    update.fulfillmentStatus = 'pending';
  } else if (status === 'paid') {
    update.payStatus = 'paid';
    update.fulfillmentStatus = 'opening';
  } else if (status === 'fulfilled') {
    update.payStatus = 'paid';
    update.fulfillmentStatus = 'fulfilled';
  } else if (status === 'refunded') {
    update.payStatus = 'refunded';
  } else if (status === 'closed') {
    update.payStatus = 'closed';
  }
  return update;
}

async function updateOrder(event: Event, orderId: string): Promise<HttpResponse> {
  const body = parseBody(event);
  await adminCollection('orders').doc(orderId).update({ data: normalizeOrderUpdate(body) });
  return listOrders(event);
}

function normalizeNewsInput(body: Record<string, unknown>, existing?: AiNewsRecord): AiNewsRecord {
  const now = Date.now();
  const title = sanitizeText(body.title, 80);
  const summary = sanitizeText(body.summary, 240);
  const sourceName = sanitizeText(body.sourceName, 40) || '编辑精选';
  const status = body.status === 'published' || body.status === 'archived' ? body.status : 'draft';
  const publishedAt = typeof body.publishAt === 'string' ? Date.parse(body.publishAt) : Number(body.publishAt);
  if (!title) {
    throw withStatus(new Error('资讯标题不能为空'), 422);
  }
  return {
    title,
    summary,
    contentMarkdown: existing?.contentMarkdown ?? summary,
    sourceName,
    sourcePlatform: existing?.sourcePlatform ?? 'manual',
    tags: existing?.tags ?? [],
    viewCount: Number(existing?.viewCount ?? 0),
    likeCount: Number(existing?.likeCount ?? 0),
    repostCount: Number(existing?.repostCount ?? 0),
    commentCount: Number(existing?.commentCount ?? 0),
    score: Number(existing?.score ?? 0),
    status,
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function listNews(event: Event): Promise<HttpResponse> {
  await ensureCollection('aiNews');
  const records = await readCollection<AiNewsRecord>('aiNews');
  const data = records
    .sort((left, right) => right.publishedAt - left.publishedAt)
    .slice(0, 200)
    .map(toNewsView);
  return ok(event, data);
}

async function createNews(event: Event): Promise<HttpResponse> {
  const record = normalizeNewsInput(parseBody(event));
  await ensureCollection('aiNews');
  await adminCollection('aiNews').add({ data: record });
  return listNews(event);
}

async function updateNews(event: Event, newsId: string): Promise<HttpResponse> {
  const doc = await adminCollection('aiNews').doc(newsId).get();
  const existing = doc.data as AiNewsRecord | undefined;
  await adminCollection('aiNews').doc(newsId).update({ data: normalizeNewsInput(parseBody(event), existing) });
  return listNews(event);
}

async function listTools(event: Event): Promise<HttpResponse> {
  await ensureCollection('aiTools');
  const [records, runCounts] = await Promise.all([
    readCollection<AdminToolRecord>('aiTools'),
    getToolRunCounts(),
  ]);
  const data = mergeToolRecords(records)
    .sort((left, right) => normalizeAiToolSortOrder(left.sortOrder, 999) - normalizeAiToolSortOrder(right.sortOrder, 999))
    .slice(0, 200)
    .map((record) => toToolView(record, runCounts));
  return ok(event, data);
}

function normalizeToolInput(
  body: Record<string, unknown>,
  existing?: AdminToolRecord,
  fallbackToolId?: string,
): AdminToolRecord {
  const now = Date.now();
  const name = sanitizeText(body.name, 40) || sanitizeAiToolConfigText(body.cardTitle, 40);
  if (!name) {
    throw withStatus(new Error('工具名称不能为空'), 422);
  }
  const requestedToolId = sanitizeText(body.toolId, 60);
  const toolId = (existing?.toolId ?? fallbackToolId ?? requestedToolId) || createCustomToolId(name);
  return {
    toolId,
    name,
    category: normalizeToolCategory(body.category),
    status: normalizeToolStatus(body.status),
    runCount: Number(existing?.runCount ?? 0),
    pointCost: sanitizeNumber(body.pointCost),
    trialLimit: sanitizeNumber(body.trialLimit),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    builtIn: existing?.builtIn ?? isBuiltInAdminTool(toolId),
    deleted: false,
    cardTitle: sanitizeAiToolConfigText(body.cardTitle, 40) || name,
    cardDescription: sanitizeAiToolConfigText(body.cardDescription, 120),
    cardBadge: sanitizeAiToolConfigText(body.cardBadge, 20),
    tags: normalizeAiToolTags(body.tags, [sanitizeAiToolConfigText(body.cardBadge, 20)].filter(Boolean)),
    icon: sanitizeAiToolConfigText(body.icon, 8),
    iconImageFileId: sanitizeAiToolConfigText(body.iconImageFileId, 500),
    visible: body.visible !== false,
    sortOrder: normalizeAiToolSortOrder(body.sortOrder, existing?.sortOrder ?? 999),
    outputType: normalizeToolOutputType(body.outputType, existing?.outputType),
    workerModel: normalizeAiToolWorkerModel(body.workerModel, existing?.workerModel),
    intro: normalizeAiToolIntroConfig(body.intro),
  };
}

async function createTool(event: Event): Promise<HttpResponse> {
  await ensureCollection('aiTools');
  await adminCollection('aiTools').add({ data: normalizeToolInput(parseBody(event)) });
  return listTools(event);
}

async function updateTool(event: Event, toolId: string): Promise<HttpResponse> {
  await ensureCollection('aiTools');
  const records = await readCollection<AdminToolRecord>('aiTools');
  const existing = findToolRecord(records, toolId);
  const record = normalizeToolInput(parseBody(event), existing, toolId);
  if (existing) {
    await adminCollection('aiTools').doc(existing._id).update({ data: record });
  } else {
    await adminCollection('aiTools').add({ data: record });
  }
  return listTools(event);
}

async function deleteTool(event: Event, toolId: string): Promise<HttpResponse> {
  const body = parseBody(event);
  if (body.confirm !== 'DELETE') {
    return fail(event, 400, '删除操作缺少二次确认');
  }

  await ensureCollection('aiTools');
  const records = await readCollection<AdminToolRecord>('aiTools');
  const existing = findToolRecord(records, toolId);
  const targetToolId = existing?.toolId ?? toolId;

  if (isBuiltInAdminTool(targetToolId)) {
    const now = Date.now();
    const defaultDefinition = getDefaultAdminToolDefinitions().find((definition) => definition.toolId === targetToolId);
    const baseRecord = defaultDefinition ? buildDefaultAiToolRecord(defaultDefinition) : undefined;
    const deletedRecord: AdminToolRecord = {
      ...(baseRecord ? getWritableToolRecord(baseRecord) : {}),
      ...(existing ? getWritableToolRecord(existing) : {}),
      toolId: targetToolId,
      name: existing?.name ?? baseRecord?.name ?? targetToolId,
      category: existing?.category ?? baseRecord?.category ?? 'text',
      status: 'disabled',
      runCount: Number(existing?.runCount ?? baseRecord?.runCount ?? 0),
      pointCost: Number(existing?.pointCost ?? baseRecord?.pointCost ?? 0),
      trialLimit: Number(existing?.trialLimit ?? baseRecord?.trialLimit ?? 0),
      tags: normalizeAiToolTags(existing?.tags, baseRecord?.tags ?? []),
      sortOrder: normalizeAiToolSortOrder(existing?.sortOrder, baseRecord?.sortOrder ?? 999),
      createdAt: existing?.createdAt ?? baseRecord?.createdAt ?? now,
      updatedAt: now,
      builtIn: true,
      deleted: true,
    };
    if (existing) {
      await adminCollection('aiTools').doc(existing._id).update({ data: deletedRecord });
    } else {
      await adminCollection('aiTools').add({ data: deletedRecord });
    }
    return ok(event, { deleted: true });
  }

  if (!existing) {
    return fail(event, 404, '工具不存在');
  }
  await adminCollection('aiTools').doc(existing._id).remove();
  return ok(event, { deleted: true });
}

async function listProductTypes(event: Event): Promise<HttpResponse> {
  await ensureCollection('productTypes');
  const records = await readCollection<ProductTypeRecord>('productTypes');
  const data = records
    .sort((left, right) => normalizeSort(left.sort, 999) - normalizeSort(right.sort, 999))
    .slice(0, 200)
    .map(toProductTypeView);
  return ok(event, data);
}

async function createProductType(event: Event): Promise<HttpResponse> {
  await ensureCollection('productTypes');
  await adminCollection('productTypes').add({ data: normalizeProductTypeInput(parseBody(event)) });
  return listProductTypes(event);
}

async function updateProductType(event: Event, productId: string): Promise<HttpResponse> {
  await ensureCollection('productTypes');
  const records = await readCollection<ProductTypeRecord>('productTypes');
  const existing = findProductTypeRecord(records, productId);
  const record = normalizeProductTypeInput(parseBody(event), existing, productId);
  if (existing) {
    await adminCollection('productTypes').doc(existing._id).update({ data: record });
  } else {
    await adminCollection('productTypes').add({ data: record });
  }
  return listProductTypes(event);
}

async function deleteProductType(event: Event, productId: string): Promise<HttpResponse> {
  const body = parseBody(event);
  if (body.confirm !== 'DELETE') {
    return fail(event, 400, '删除操作缺少二次确认');
  }
  await ensureCollection('productTypes');
  const records = await readCollection<ProductTypeRecord>('productTypes');
  const existing = findProductTypeRecord(records, productId);
  if (!existing) {
    return fail(event, 404, '商品类型不存在');
  }
  await adminCollection('productTypes').doc(existing._id).remove();
  return ok(event, { deleted: true });
}

async function listMemberPlans(event: Event): Promise<HttpResponse> {
  await ensureCollection('memberPlans');
  const records = await readCollection<MemberPlanRecord>('memberPlans');
  const data = records
    .sort((left, right) => normalizeSort(left.sort, 999) - normalizeSort(right.sort, 999))
    .slice(0, 300)
    .map(toMemberPlanView);
  return ok(event, data);
}

async function createMemberPlan(event: Event): Promise<HttpResponse> {
  await ensureCollection('memberPlans');
  await adminCollection('memberPlans').add({ data: normalizeMemberPlanInput(parseBody(event)) });
  return listMemberPlans(event);
}

async function updateMemberPlan(event: Event, planId: string): Promise<HttpResponse> {
  await ensureCollection('memberPlans');
  const records = await readCollection<MemberPlanRecord>('memberPlans');
  const existing = findMemberPlanRecord(records, planId);
  const record = normalizeMemberPlanInput(parseBody(event), existing, planId);
  if (existing) {
    await adminCollection('memberPlans').doc(existing._id).update({ data: record });
  } else {
    await adminCollection('memberPlans').add({ data: record });
  }
  return listMemberPlans(event);
}

async function deleteMemberPlan(event: Event, planId: string): Promise<HttpResponse> {
  const body = parseBody(event);
  if (body.confirm !== 'DELETE') {
    return fail(event, 400, '删除操作缺少二次确认');
  }
  await ensureCollection('memberPlans');
  const records = await readCollection<MemberPlanRecord>('memberPlans');
  const existing = findMemberPlanRecord(records, planId);
  if (!existing) {
    return fail(event, 404, '套餐不存在');
  }
  await adminCollection('memberPlans').doc(existing._id).remove();
  return ok(event, { deleted: true });
}

async function getAdminPointsConfig(event: Event): Promise<HttpResponse> {
  const config = await getPointsConfig();
  return ok(event, toPointsConfigView(config));
}

async function updateAdminPointsConfig(event: Event): Promise<HttpResponse> {
  const existing = await getStoredPointsConfigRecord();
  const record = normalizePointsConfigInput(parseBody(event), existing);
  if (existing) {
    await adminCollection('pointsConfig').doc(existing._id).update({ data: record });
  } else {
    await adminCollection('pointsConfig').add({ data: record });
  }
  return ok(event, toPointsConfigView(record));
}

async function getDashboard(event: Event): Promise<HttpResponse> {
  const [usersResponse, ordersResponse, newsResponse, toolsResponse] = await Promise.all([
    listUsers(event),
    listOrders(event),
    listNews(event),
    listTools(event),
  ]);
  const users = (JSON.parse(usersResponse.body) as { data: AdminUserView[] }).data;
  const orders = (JSON.parse(ordersResponse.body) as { data: AdminOrderView[] }).data;
  const news = (JSON.parse(newsResponse.body) as { data: AdminNewsView[] }).data;
  const tools = (JSON.parse(toolsResponse.body) as { data: AdminToolView[] }).data;
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const revenue = paidOrders.reduce((sum, order) => sum + order.amountCents, 0);
  const toolRuns = tools.reduce((sum, tool) => sum + tool.runCount, 0);
  const data: DashboardPayload = {
    metrics: [
      { id: 'users', label: '用户总数', value: users.length.toLocaleString('zh-CN'), detail: '后台当前可见用户' },
      { id: 'orders', label: '订单收入', value: `¥${(revenue / 100).toLocaleString('zh-CN')}`, detail: `${paidOrders.length} 个已支付订单` },
      { id: 'news', label: 'AI 新闻', value: news.length.toLocaleString('zh-CN'), detail: `${news.filter((item) => item.status === 'published').length} 篇已发布` },
      { id: 'tools', label: '工具调用', value: toolRuns.toLocaleString('zh-CN'), detail: `${tools.length} 个后台配置工具` },
    ],
    recentOrders: orders.slice(0, 5),
    recentNews: news.slice(0, 5),
  };
  return ok(event, data);
}

async function route(event: Event): Promise<HttpResponse> {
  const method = getMethod(event);
  if (method === 'OPTIONS') {
    return jsonResponse(event, 204, null);
  }
  assertAdminToken(event);

  const path = getPath(event);
  if (path.replace(/^\/admin-api/, '') === '/dashboard' && method === 'GET') {
    return getDashboard(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/tool-assets' && method === 'POST') {
    return uploadToolAsset(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/tool-assets/chunks' && method === 'POST') {
    return uploadToolAssetChunk(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/files/chunks' && method === 'POST') {
    return uploadAdminFileChunk(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/points-config' && method === 'GET') {
    return getAdminPointsConfig(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/points-config' && method === 'PATCH') {
    return updateAdminPointsConfig(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/app-config' && method === 'GET') {
    return getAdminAppConfig(event);
  }
  if (path.replace(/^\/admin-api/, '') === '/app-config' && method === 'PATCH') {
    return updateAdminAppConfig(event);
  }

  const matched = matchRoute(path);
  const { resource, id } = matched;
  if (!resource) {
    return fail(event, 404, '后台接口不存在');
  }

  if (method === 'GET' && !id) {
    if (resource === 'users') return listUsers(event);
    if (resource === 'orders') return listOrders(event);
    if (resource === 'news') return listNews(event);
    if (resource === 'tools') return listTools(event);
    if (resource === 'product-types') return listProductTypes(event);
    if (resource === 'files') return listAdminFiles(event);
    return listMemberPlans(event);
  }

  if (method === 'POST' && !id) {
    if (resource === 'news') return createNews(event);
    if (resource === 'tools') return createTool(event);
    if (resource === 'product-types') return createProductType(event);
    if (resource === 'plans') return createMemberPlan(event);
    if (resource === 'files') return uploadAdminFile(event);
    return fail(event, 405, '用户和订单不支持后台新增');
  }

  if (method === 'PATCH' && id) {
    if (resource === 'users') return updateUser(event, id);
    if (resource === 'orders') return updateOrder(event, id);
    if (resource === 'news') return updateNews(event, id);
    if (resource === 'tools') return updateTool(event, id);
    if (resource === 'product-types') return updateProductType(event, id);
    if (resource === 'files') return updateAdminFile(event, id);
    return updateMemberPlan(event, id);
  }

  if (method === 'DELETE' && id) {
    if (resource === 'users') return deleteDocument(event, 'users', id);
    if (resource === 'orders') return deleteDocument(event, 'orders', id);
    if (resource === 'news') return deleteDocument(event, 'aiNews', id);
    if (resource === 'tools') return deleteTool(event, id);
    if (resource === 'product-types') return deleteProductType(event, id);
    if (resource === 'files') return deleteAdminFile(event, id);
    return deleteMemberPlan(event, id);
  }

  return fail(event, 405, '请求方法不支持');
}

export async function main(event: Event): Promise<HttpResponse> {
  try {
    return await route(event);
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
    const message = error instanceof Error ? error.message : '后台接口异常';
    return fail(event, statusCode, statusCode >= 500 ? '后台接口异常' : message);
  }
}
