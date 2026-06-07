import https from 'node:https';
import { decryptAiAccountPassword } from '../shared/ai-account';
import { _, app, collection, ensureCollection, getLatestUnusedEmailVerificationCode, getOrderByNo, getUserById } from '../shared/db';
import { fulfillPaidOrderMembership } from '../shared/orders';
import { isValidMainlandMobile, normalizeMobile } from '../shared/utils';
import type { AiNewsRecord, AppStoreAccountRecord, FulfillmentStatus, OrderRecord, UserRecord } from '../shared/types';

interface Event {
  httpMethod?: string;
  method?: string;
  path?: string;
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  action?:
    | 'listTasks'
    | 'updateTask'
    | 'getVerificationCode'
    | 'getAvailableAppStoreAccount'
    | 'generateAppStoreAccount'
    | 'saveAppStoreAccount'
    | 'createNews'
    | 'uploadNewsCover';
  status?: string;
  orderNo?: string;
  note?: string;
}

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

type OperatorTaskStatus = 'opening' | 'processing' | 'fulfilled' | 'failed';

const DEFAULT_NEWS_REMINDER_TEMPLATE_ID = 'm7Cb5rMgtJtFdyVn3YvR671tWZwyK87qe6qKr7KPZrQ';
const APPSTORE_EMAIL_DOMAIN = 'mraclpivot.com';
const DEFAULT_APPSTORE_MOBILE = '15810901111';
const SUPER_OPERATOR_MOBILE = '15501130351';
const APPSTORE_PASSWORD_SPECIALS = '!@#$%^&*';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'content-type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode: number, payload: unknown): HttpResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

function ok<T>(data: T): HttpResponse {
  return jsonResponse(200, {
    code: 0,
    message: 'ok',
    data,
  });
}

function fail(statusCode: number, message: string): HttpResponse {
  return jsonResponse(statusCode, {
    code: statusCode,
    message,
    data: null,
  });
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
  return event.rawPath ?? event.path ?? '';
}

function parseBody(event: Event): Record<string, unknown> {
  if (!event.body) {
    return {};
  }
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function assertOperatorToken(event: Event): void {
  const expected = process.env.OPERATOR_API_TOKEN;
  if (!expected || expected.length < 16) {
    throw new Error('缺少运营接口密钥配置：OPERATOR_API_TOKEN');
  }

  const authorization = getHeader(event, 'authorization');
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (token !== expected) {
    const error = new Error('运营密钥不正确');
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

function normalizeStatus(status?: string): OperatorTaskStatus {
  if (status === 'processing' || status === 'fulfilled' || status === 'failed') {
    return status;
  }
  return 'opening';
}

function matchTaskRoute(event: Event): {
  action:
    | 'listTasks'
    | 'updateTask'
    | 'getVerificationCode'
    | 'getAvailableAppStoreAccount'
    | 'generateAppStoreAccount'
    | 'saveAppStoreAccount'
    | 'createNews'
    | 'uploadNewsCover';
  orderNo?: string;
} | null {
  if (event.action === 'listTasks') {
    return { action: 'listTasks' };
  }
  if (event.action === 'updateTask' && event.orderNo) {
    return { action: 'updateTask', orderNo: event.orderNo };
  }
  if (event.action === 'getVerificationCode' && event.orderNo) {
    return { action: 'getVerificationCode', orderNo: event.orderNo };
  }
  if (event.action === 'getAvailableAppStoreAccount' && event.orderNo) {
    return { action: 'getAvailableAppStoreAccount', orderNo: event.orderNo };
  }
  if (event.action === 'generateAppStoreAccount') {
    return { action: 'generateAppStoreAccount' };
  }
  if (event.action === 'saveAppStoreAccount') {
    return { action: 'saveAppStoreAccount' };
  }
  if (event.action === 'createNews') {
    return { action: 'createNews' };
  }
  if (event.action === 'uploadNewsCover') {
    return { action: 'uploadNewsCover' };
  }

  const method = getMethod(event);
  const path = getPath(event).replace(/\/$/, '');
  if (method === 'GET' && /(?:^|\/)(?:operator\/)?tasks$/.test(path)) {
    return { action: 'listTasks' };
  }

  if (method === 'POST' && /(?:^|\/)(?:operator\/)?news$/.test(path)) {
    return { action: 'createNews' };
  }

  if (method === 'POST' && /(?:^|\/)(?:operator\/)?news\/cover$/.test(path)) {
    return { action: 'uploadNewsCover' };
  }

  if (method === 'POST' && /(?:^|\/)(?:operator\/)?appstore-accounts\/generate$/.test(path)) {
    return { action: 'generateAppStoreAccount' };
  }

  if (method === 'POST' && /(?:^|\/)(?:operator\/)?appstore-accounts$/.test(path)) {
    return { action: 'saveAppStoreAccount' };
  }

  const codeMatched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)\/verification-code$/);
  if (method === 'GET' && codeMatched?.[1]) {
    return { action: 'getVerificationCode', orderNo: decodeURIComponent(codeMatched[1]) };
  }

  const appstoreMatched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)\/appstore-account$/);
  if (method === 'GET' && appstoreMatched?.[1]) {
    return { action: 'getAvailableAppStoreAccount', orderNo: decodeURIComponent(appstoreMatched[1]) };
  }

  const matched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)$/);
  if (method === 'POST' && matched?.[1]) {
    return { action: 'updateTask', orderNo: decodeURIComponent(matched[1]) };
  }

  return null;
}

function isOrderVisibleForStatus(order: OrderRecord, status: OperatorTaskStatus): boolean {
  if (order.payStatus !== 'paid') {
    return false;
  }
  const fulfillmentStatus = order.fulfillmentStatus ?? 'opening';
  if (status === 'processing') {
    return fulfillmentStatus === 'opening' && Boolean(order.operatorProcessingAt);
  }
  if (status === 'opening') {
    return fulfillmentStatus === 'opening';
  }
  return fulfillmentStatus === status;
}

function sanitizeNote(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 200);
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeAppStoreMobile(value: unknown): string {
  const mobile = normalizeMobile(sanitizeText(value, 20));
  if (!mobile) {
    return DEFAULT_APPSTORE_MOBILE;
  }
  if (!isValidMainlandMobile(mobile)) {
    throw new Error('Apple Store 手机号格式不正确');
  }
  return mobile;
}

function getAppStoreMobileTail(value: unknown): string {
  const mobile = normalizeAppStoreMobile(value);
  return mobile.slice(-4);
}

function isSuperOperatorMobile(value: unknown): boolean {
  return normalizeMobile(sanitizeText(value, 20)) === SUPER_OPERATOR_MOBILE;
}

function sanitizeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function normalizeAppStoreEmail(value: unknown): string {
  return sanitizeText(value, 80).toLowerCase();
}

function isValidAppStoreEmail(email: string): boolean {
  return new RegExp(`^[a-z0-9._%+-]+@${APPSTORE_EMAIL_DOMAIN.replace('.', '\\.')}$`).test(email);
}

function isValidAppStorePassword(password: string): boolean {
  return (
    password.length >= 8
    && /[0-9]/.test(password)
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[!@#$%^&*]/.test(password)
  );
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomFrom(characters: string): string {
  return characters[randomInt(characters.length)] ?? characters[0];
}

function shuffleText(value: string): string {
  const chars = value.split('');
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [chars[index], chars[target]] = [chars[target], chars[index]];
  }
  return chars.join('');
}

function generateAppStorePassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pool = `${lower}${upper}${digits}${APPSTORE_PASSWORD_SPECIALS}`;
  const required = [
    randomFrom(upper),
    randomFrom(lower),
    randomFrom(digits),
    randomFrom(APPSTORE_PASSWORD_SPECIALS),
  ];
  while (required.length < 12) {
    required.push(randomFrom(pool));
  }
  return shuffleText(required.join(''));
}

function serializeAppStoreAccount(account: AppStoreAccountRecord & { _id: string }) {
  return {
    id: account._id,
    email: account.email,
    mobile: account.mobile,
    password: account.password,
    status: account.status,
    chatgptAccountEmail: account.chatgptAccountEmail ?? '',
    orderNo: account.orderNo ?? '',
  };
}

async function findAppStoreAccountByEmail(email: string): Promise<(AppStoreAccountRecord & { _id: string }) | null> {
  await ensureCollection('appstoreAccounts');
  const result = await collection('appstoreAccounts').where({ email }).limit(1).get();
  return (result.data[0] as (AppStoreAccountRecord & { _id: string }) | undefined) ?? null;
}

async function getAppStoreAccountById(accountId: string): Promise<(AppStoreAccountRecord & { _id: string }) | null> {
  if (!accountId) {
    return null;
  }
  await ensureCollection('appstoreAccounts');
  try {
    const result = await collection('appstoreAccounts').doc(accountId).get();
    return (result.data as (AppStoreAccountRecord & { _id: string }) | undefined) ?? null;
  } catch {
    return null;
  }
}

async function getAppStoreAccountByOrderNo(orderNo: string): Promise<(AppStoreAccountRecord & { _id: string }) | null> {
  await ensureCollection('appstoreAccounts');
  const result = await collection('appstoreAccounts').where({ orderNo }).limit(1).get();
  return (result.data[0] as (AppStoreAccountRecord & { _id: string }) | undefined) ?? null;
}

async function getAppStoreAccountByChatgptEmail(chatgptAccountEmail: string): Promise<(AppStoreAccountRecord & { _id: string }) | null> {
  if (!chatgptAccountEmail) {
    return null;
  }
  await ensureCollection('appstoreAccounts');
  const result = await collection('appstoreAccounts').where({ chatgptAccountEmail }).limit(1).get();
  return (result.data[0] as (AppStoreAccountRecord & { _id: string }) | undefined) ?? null;
}

async function resolveOrderAppStoreAccount(order: OrderRecord, user?: UserRecord | null): Promise<(AppStoreAccountRecord & { _id: string }) | null> {
  const byOrderNo = await getAppStoreAccountByOrderNo(order.orderNo);
  if (byOrderNo) {
    return byOrderNo;
  }
  const email = user?.aiAccountEmail ?? '';
  if (!email) {
    return null;
  }
  return getAppStoreAccountByChatgptEmail(email);
}

async function generateUniqueAppStoreEmail(): Promise<string> {
  await ensureCollection('appstoreAccounts');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const random = Math.random().toString(36).slice(2, 8);
    const suffix = Date.now().toString(36).slice(-5);
    const email = `as${suffix}${random}@${APPSTORE_EMAIL_DOMAIN}`;
    const existing = await findAppStoreAccountByEmail(email);
    if (!existing) {
      return email;
    }
  }
  throw new Error('随机账号生成失败，请重试');
}

function normalizeSourcePlatform(value: unknown): AiNewsRecord['sourcePlatform'] {
  if (value === 'x' || value === 'blog' || value === 'official' || value === 'manual') {
    return value;
  }
  return 'manual';
}

function normalizeTagKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function resolveParentTags(tag: string): string[] {
  const key = normalizeTagKey(tag);
  const parentTags: string[] = [];
  const aiGiantKeys = [
    'openai',
    'googleai',
    'google',
    'deepmind',
    'googledeepmind',
    'claudeai',
    'claude',
    'anthropic',
    'metaai',
    'microsoftai',
    'xai',
    'grok',
  ];
  if (aiGiantKeys.includes(key)) {
    parentTags.push('AI巨头');
  }
  const toolKeys = [
    'ai工具',
    '工具',
    '开发者工具',
    'agent',
    '图片生成',
    '视频生成',
    '办公提效',
    '编程助手',
    '提示词',
    'github',
    'huggingface',
  ];
  if (toolKeys.includes(key)) {
    parentTags.push('工具');
  }
  const tutorialKeys = [
    '教程',
    '使用教程',
    '实战教程',
    '入门指南',
    '案例拆解',
    '开发实践',
    '指南',
    '教学',
    'howto',
    'tutorial',
  ];
  if (tutorialKeys.includes(key)) {
    parentTags.push('教程');
  }
  return parentTags;
}

function normalizeTags(value: unknown): string[] {
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，]+/)
      : [];
  const tags = rawTags
    .map((item) => sanitizeText(item, 20))
    .filter(Boolean);
  const expandedTags = tags.flatMap((tag) => [tag, ...resolveParentTags(tag)]);
  return Array.from(new Set(expandedTags)).slice(0, 12);
}

function normalizeMarkdown(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 20000) : '';
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackNewsMeta(markdown: string): { title: string; summary: string } {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const heading = lines.find((line) => /^#{1,3}\s+/.test(line));
  const plain = stripMarkdown(markdown);
  const title = sanitizeText(heading?.replace(/^#{1,3}\s+/, '') || plain.slice(0, 36), 80) || 'AI 技术新动态';
  const summary = sanitizeText(plain.slice(0, 150), 260) || '这是一篇关于 AI 最新动态和实际应用价值的整理文章。';
  return { title, summary };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const matched = text.match(/\{[\s\S]*}/);
  if (!matched) {
    return null;
  }
  try {
    const parsed = JSON.parse(matched[0]) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(url, {
      method: 'POST',
      headers: {
        ...headers,
        'content-length': Buffer.byteLength(payload),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`云开发 AI 调用失败：${response.statusCode} ${text.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error('云开发 AI 返回非 JSON'));
        }
      });
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function generateNewsMetaByTencentAi(markdown: string): Promise<{ title: string; summary: string } | null> {
  const apiKey = process.env.TCB_AI_API_KEY;
  const baseUrl = process.env.TCB_AI_BASE_URL;
  if (process.env.TCB_AI_NEWS_META_ENABLED !== 'true' || !apiKey || !baseUrl) {
    return null;
  }

  try {
    const modelName = process.env.TCB_AI_MODEL || 'hy3-preview';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const result = await postJson(endpoint, {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
    }, {
      model: modelName,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: '你是 AI 科技资讯编辑。请只输出 JSON，不要输出 Markdown。',
        },
        {
          role: 'user',
          content: `请根据下面这篇文章生成适合小程序 AI 资讯卡片的标题和摘要。标题不超过 32 个汉字，摘要 80-120 个汉字，客观克制，不夸大，不使用“震惊”等营销词。\n\n文章：\n${markdown.slice(0, 8000)}\n\n输出格式：{"title":"...","summary":"..."}`,
        },
      ],
    }) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const text = result.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonObject(text);
    const title = sanitizeText(parsed?.title, 80);
    const summary = sanitizeText(parsed?.summary, 260);
    return title && summary ? { title, summary } : null;
  } catch (error) {
    console.warn('ai.news.meta.generate.failed', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function parseDataUrl(value: unknown): { mimeType: string; extension: string; bytes: Buffer } | null {
  if (typeof value !== 'string') {
    return null;
  }
  const matched = value.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!matched) {
    return null;
  }
  const mimeType = matched[1];
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const bytes = Buffer.from(matched[2], 'base64');
  if (bytes.length > 3 * 1024 * 1024) {
    throw new Error('头图不能超过 3MB');
  }
  return { mimeType, extension, bytes };
}

function getImageExtension(mimeType: string): string {
  return mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
}

async function uploadNewsCoverFile(file: { mimeType: string; extension: string; bytes: Buffer }, now: number): Promise<string> {
  if (file.bytes.length > 3 * 1024 * 1024) {
    throw new Error('头图不能超过 3MB');
  }
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const result = await app.uploadFile({
    cloudPath: `ai-news/covers/${now}-${random}.${file.extension}`,
    fileContent: file.bytes,
  });
  return result.fileID;
}

async function uploadNewsCover(dataUrl: unknown, now: number): Promise<string> {
  const file = parseDataUrl(dataUrl);
  return file ? uploadNewsCoverFile(file, now) : '';
}

function parseImageEventBody(event: Event): { mimeType: string; extension: string; bytes: Buffer } {
  const contentType = getHeader(event, 'content-type').split(';')[0].trim().toLowerCase();
  if (!/^image\/(?:png|jpe?g|webp)$/.test(contentType)) {
    throw new Error('头图仅支持 PNG/JPG/WebP');
  }
  if (!event.body) {
    throw new Error('缺少头图文件');
  }
  const bytes = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body, 'binary');
  if (bytes.length === 0) {
    throw new Error('缺少头图文件');
  }
  return {
    mimeType: contentType,
    extension: getImageExtension(contentType),
    bytes,
  };
}

async function uploadNewsCoverFromEvent(event: Event): Promise<HttpResponse> {
  const now = Date.now();
  const file = parseImageEventBody(event);
  const coverFileId = await uploadNewsCoverFile(file, now);
  return ok({ coverFileId });
}

function calcNewsScore(input: Pick<AiNewsRecord, 'viewCount' | 'likeCount' | 'repostCount' | 'commentCount' | 'publishedAt'>): number {
  const ageHours = Math.max(0, (Date.now() - input.publishedAt) / (60 * 60 * 1000));
  const freshness = Math.max(0.42, 1 - ageHours / 96);
  return Math.round((
    input.viewCount +
    input.likeCount * 20 +
    input.repostCount * 50 +
    input.commentCount * 30
  ) * freshness);
}

function formatTemplateTime(timestamp: number): string {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function truncateTemplateText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

async function sendNewsReminderToSubscribers(newsId: string, record: AiNewsRecord): Promise<{ sent: number; failed: number }> {
  const templateId = process.env.WX_NEWS_REMINDER_TEMPLATE_ID || DEFAULT_NEWS_REMINDER_TEMPLATE_ID;
  const openapi = (app as unknown as {
    openapi?: {
      subscribeMessage?: {
        send(payload: unknown): Promise<unknown>;
      };
    };
  }).openapi;
  if (!templateId || !openapi?.subscribeMessage?.send) {
    console.warn(JSON.stringify({
      tag: 'aiNews.reminder.skipped',
      reason: !templateId ? 'missingTemplateId' : 'missingSubscribeMessageOpenapi',
      newsId,
    }));
    return { sent: 0, failed: 0 };
  }

  const result = await collection('users')
    .where({
      newsSubscribeMsgAuth: true,
      newsSubscribeMsgQuota: _.gt(0),
    })
    .limit(50)
    .get();
  const users = result.data as Array<UserRecord & { _id: string }>;
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.openid) continue;
    try {
      await openapi.subscribeMessage.send({
        touser: user.openid,
        templateId,
        page: `pages/news-detail/index?id=${encodeURIComponent(newsId)}`,
        data: {
          thing1: { value: truncateTemplateText(record.title, 20) },
          time2: { value: formatTemplateTime(record.publishedAt) },
          thing3: { value: truncateTemplateText(record.summary || record.title, 20) },
        },
      });
      await collection('users').doc(user._id).update({
        data: {
          newsSubscribeMsgQuota: _.inc(-1),
          updatedAt: Date.now(),
        },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        tag: 'aiNews.reminder.send.failed',
        newsId,
        userId: user._id,
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return { sent, failed };
}

async function buildTask(order: OrderRecord & { _id: string }) {
  const user = await getUserById(order.userId);
  const appStoreAccount = await resolveOrderAppStoreAccount(order, user);
  let password = '';
  if (user?.aiAccountPasswordEncrypted) {
    try {
      password = decryptAiAccountPassword(user.aiAccountPasswordEncrypted);
    } catch (error) {
      console.error(JSON.stringify({
        tag: 'operator.task.passwordDecryptFailed',
        orderNo: order.orderNo,
        userId: order.userId,
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return {
    orderNo: order.orderNo,
    productName: order.productName,
    planCode: order.planCode,
    planName: order.planName,
    amount: order.amount,
    paidAt: order.paidAt,
    fulfillmentStatus: order.fulfillmentStatus ?? 'opening',
    operatorProcessingAt: order.operatorProcessingAt,
    operatorNote: order.operatorNote ?? '',
    userId: order.userId,
    mobile: user?.mobile ?? '',
    nickname: user?.nickname ?? '',
    email: user?.aiAccountEmail ?? '',
    password,
    appleStoreAccount: appStoreAccount ? serializeAppStoreAccount(appStoreAccount) : null,
  };
}

async function listTasks(event: Event): Promise<HttpResponse> {
  const status = normalizeStatus(event.queryStringParameters?.status ?? event.status);
  const operatorMobile = normalizeAppStoreMobile(event.queryStringParameters?.mobile ?? DEFAULT_APPSTORE_MOBILE);
  const result = await collection('orders')
    .where({
      payStatus: 'paid',
    })
    .get();
  const orderRecords = result.data as Array<OrderRecord & { _id: string }>;
  const visibleOrders = [];
  for (const order of orderRecords) {
    if (!isOrderVisibleForStatus(order, status)) {
      continue;
    }
    if (isSuperOperatorMobile(operatorMobile)) {
      visibleOrders.push(order);
      continue;
    }
    const user = await getUserById(order.userId);
    const linkedAccount = await resolveOrderAppStoreAccount(order, user);
    if (!linkedAccount) {
      visibleOrders.push(order);
      continue;
    }
    if (normalizeMobile(linkedAccount.mobile).endsWith(getAppStoreMobileTail(operatorMobile))) {
      visibleOrders.push(order);
    }
  }
  const orders = visibleOrders
    .sort((left, right) => (right.paidAt ?? right.createdAt) - (left.paidAt ?? left.createdAt))
    .slice(0, 50);
  const tasks = await Promise.all(orders.map(buildTask));
  return ok({ tasks });
}

async function updateTask(orderNo: string, body: Record<string, unknown>, event: Event): Promise<HttpResponse> {
  const status = normalizeStatus(String(body.status ?? event.status ?? ''));
  const note = sanitizeNote(body.note ?? event.note);
  const appStoreAccountId = sanitizeText(body.appleStoreAccountId, 80);
  const operatorMobile = normalizeAppStoreMobile(body.mobile ?? event.queryStringParameters?.mobile ?? DEFAULT_APPSTORE_MOBILE);
  const operatorTail = getAppStoreMobileTail(operatorMobile);
  const privileged = isSuperOperatorMobile(operatorMobile);
  const order = await getOrderByNo(orderNo);
  if (!order) {
    return fail(404, '订单不存在');
  }
  if (order.payStatus !== 'paid') {
    return fail(400, '订单未支付，不能处理开通');
  }

  const now = Date.now();
  if (status === 'fulfilled') {
    if (!appStoreAccountId) {
      return fail(400, '请先获取 Apple Store 账号');
    }
    const user = await getUserById(order.userId);
    if (!user?.aiAccountEmail) {
      return fail(400, '该订单用户暂未填写 ChatGPT 注册邮箱');
    }
    const appStoreAccount = await getAppStoreAccountById(appStoreAccountId);
    if (!appStoreAccount) {
      return fail(404, 'Apple Store 账号不存在');
    }
    if (!privileged && !normalizeMobile(appStoreAccount.mobile).endsWith(operatorTail)) {
      return fail(403, '只能使用本手机号注册的 Apple Store 账号');
    }
    if (appStoreAccount.status === 'disabled') {
      return fail(400, 'Apple Store 账号已停用');
    }
    if (appStoreAccount.status === 'bound' && appStoreAccount.orderNo !== order.orderNo && appStoreAccount.chatgptAccountEmail !== user.aiAccountEmail) {
      return fail(400, 'Apple Store 账号已绑定其他订单');
    }
    await collection('appstoreAccounts').doc(appStoreAccount._id).update({
      data: {
        status: 'bound',
        chatgptAccountEmail: user.aiAccountEmail,
        orderNo: order.orderNo,
        userId: order.userId,
        boundAt: now,
        updatedAt: now,
      },
    });
    await fulfillPaidOrderMembership(order, { fulfilledAt: now });
    await collection('orders').doc(order._id).update({
      data: {
        appleStoreAccountId: appStoreAccount._id,
        appleStoreEmail: appStoreAccount.email,
        operatorNote: note,
        updatedAt: now,
      },
    });
    return ok({
      success: true,
      orderNo: order.orderNo,
      status: 'fulfilled' as FulfillmentStatus,
      appleStoreAccount: serializeAppStoreAccount({
        ...appStoreAccount,
        status: 'bound',
        chatgptAccountEmail: user.aiAccountEmail,
        orderNo: order.orderNo,
        userId: order.userId,
        boundAt: now,
        updatedAt: now,
      }),
    });
  }

  if (status === 'failed') {
    await collection('orders').doc(order._id).update({
      data: {
        fulfillmentStatus: 'failed',
        operatorFailedAt: now,
        operatorNote: note,
        updatedAt: now,
      },
    });
    return ok({ success: true, orderNo: order.orderNo, status: 'failed' as FulfillmentStatus });
  }

  await collection('orders').doc(order._id).update({
    data: {
      fulfillmentStatus: 'opening',
      operatorProcessingAt: now,
      operatorNote: note,
      updatedAt: now,
    },
  });
  return ok({ success: true, orderNo: order.orderNo, status: 'processing' });
}

async function getVerificationCode(orderNo: string): Promise<HttpResponse> {
  const order = await getOrderByNo(orderNo);
  if (!order) {
    return fail(404, '订单不存在');
  }

  const user = await getUserById(order.userId);
  if (!user?.aiAccountEmail) {
    return fail(404, '该订单用户暂未填写注册邮箱');
  }

  const codeRecord = await getLatestUnusedEmailVerificationCode(user.aiAccountEmail);
  if (!codeRecord) {
    return fail(404, '暂无可用验证码');
  }

  return ok({
    orderNo: order.orderNo,
    email: user.aiAccountEmail,
    code: codeRecord.code,
    provider: codeRecord.provider,
    subject: codeRecord.subject,
    receivedAt: codeRecord.receivedAt,
    expiresAt: codeRecord.expiresAt,
  });
}

async function generateAppStoreAccount(body: Record<string, unknown>): Promise<HttpResponse> {
  const mobile = normalizeAppStoreMobile(body.mobile);
  const email = await generateUniqueAppStoreEmail();
  return ok({
    email,
    mobile,
    password: generateAppStorePassword(),
  });
}

async function saveAppStoreAccount(body: Record<string, unknown>): Promise<HttpResponse> {
  const now = Date.now();
  const email = normalizeAppStoreEmail(body.email);
  const mobile = normalizeAppStoreMobile(body.mobile);
  const password = sanitizeText(body.password, 80);
  if (!isValidAppStoreEmail(email)) {
    return fail(400, `Apple Store 邮箱必须以 @${APPSTORE_EMAIL_DOMAIN} 结尾`);
  }
  if (!isValidAppStorePassword(password)) {
    return fail(400, '密码需至少 8 位，并包含数字、大写、小写和特殊符号');
  }
  const existing = await findAppStoreAccountByEmail(email);
  if (existing) {
    return fail(409, '该 Apple Store 邮箱已存在');
  }

  const record: AppStoreAccountRecord = {
    email,
    mobile,
    password,
    status: 'available',
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection('appstoreAccounts').add({ data: record });
  const id = result._id ?? result.id ?? '';
  return ok({
    success: true,
    account: serializeAppStoreAccount({ ...record, _id: id }),
  });
}

async function getAvailableAppStoreAccount(orderNo: string, mobile?: string): Promise<HttpResponse> {
  const order = await getOrderByNo(orderNo);
  if (!order) {
    return fail(404, '订单不存在');
  }
  if (order.payStatus !== 'paid') {
    return fail(400, '订单未支付，不能获取 Apple Store 账号');
  }
  const operatorMobile = normalizeAppStoreMobile(mobile);
  const operatorTail = getAppStoreMobileTail(operatorMobile);
  const privileged = isSuperOperatorMobile(operatorMobile);
  const user = await getUserById(order.userId);
  const bound = await resolveOrderAppStoreAccount(order, user);
  if (bound) {
    if (!privileged && !normalizeMobile(bound.mobile).endsWith(operatorTail)) {
      return fail(403, '该订单已关联其他 Apple Store 账号');
    }
    return ok({ account: serializeAppStoreAccount(bound), reused: true });
  }

  const targetTail = operatorTail;
  await ensureCollection('appstoreAccounts');
  const result = await collection('appstoreAccounts')
    .where({
      status: 'available',
    })
    .get();
  const account = (result.data as Array<AppStoreAccountRecord & { _id: string }>)
    .filter((item) => !item.orderNo && !item.chatgptAccountEmail && normalizeMobile(item.mobile).endsWith(targetTail))
    .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0))[0];
  if (!account) {
    return fail(404, `暂无尾号为 ${targetTail} 的可用 Apple Store 账号，请先到注册页保存账号`);
  }

  return ok({ account: serializeAppStoreAccount(account), reused: false });
}

async function createNews(body: Record<string, unknown>): Promise<HttpResponse> {
  const now = Date.now();
  const sourceUrl = sanitizeText(body.sourceUrl, 500);
  const contentMarkdown = normalizeMarkdown(body.contentMarkdown);
  if (!contentMarkdown) {
    return fail(400, '缺少文章正文 Markdown');
  }
  if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) {
    return fail(400, '原文链接必须是 http/https 地址');
  }

  const publishedAt = sanitizeNumber(body.publishedAt) || now;
  const coverFileId = sanitizeText(body.coverFileId, 500) || await uploadNewsCover(body.coverDataUrl, now);
  const aiMeta = await generateNewsMetaByTencentAi(contentMarkdown);
  const meta = aiMeta ?? fallbackNewsMeta(contentMarkdown);
  const record: AiNewsRecord = {
    title: meta.title,
    summary: meta.summary,
    coverFileId,
    contentMarkdown,
    sourceName: sanitizeText(body.sourceName, 30) || 'X',
    sourceUrl,
    authorName: sanitizeText(body.authorName, 40),
    sourcePlatform: normalizeSourcePlatform(body.sourcePlatform),
    tags: normalizeTags(body.tags),
    viewCount: sanitizeNumber(body.viewCount),
    likeCount: sanitizeNumber(body.likeCount),
    repostCount: sanitizeNumber(body.repostCount),
    commentCount: sanitizeNumber(body.commentCount),
    score: 0,
    status: body.status === 'draft' ? 'draft' : 'published',
    publishedAt,
    createdAt: now,
    updatedAt: now,
  };
  record.score = calcNewsScore(record);

  let result: { _id?: string; id?: string };
  try {
    result = await collection('aiNews').add({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('collection not exists') && !message.includes('DATABASE_COLLECTION_NOT_EXIST') && !message.includes('Table not exist')) {
      throw error;
    }
    await ensureCollection('aiNews');
    result = await collection('aiNews').add({ data: record });
  }
  const newsId = result._id ?? result.id ?? '';
  const reminderResult = record.status === 'published' && newsId
    ? await sendNewsReminderToSubscribers(newsId, record)
    : { sent: 0, failed: 0 };

  return ok({
    success: true,
    id: newsId,
    score: record.score,
    reminderSent: reminderResult.sent,
    reminderFailed: reminderResult.failed,
  });
}

export async function main(event: Event) {
  if (getMethod(event) === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    assertOperatorToken(event);
    const route = matchTaskRoute(event);
    if (!route) {
      return fail(404, '接口不存在');
    }
    if (route.action === 'listTasks') {
      return listTasks(event);
    }
    if (route.action === 'getVerificationCode') {
      return getVerificationCode(route.orderNo as string);
    }
    if (route.action === 'getAvailableAppStoreAccount') {
      return getAvailableAppStoreAccount(route.orderNo as string, event.queryStringParameters?.mobile);
    }
    if (route.action === 'generateAppStoreAccount') {
      return generateAppStoreAccount(parseBody(event));
    }
    if (route.action === 'saveAppStoreAccount') {
      return saveAppStoreAccount(parseBody(event));
    }
    if (route.action === 'createNews') {
      return createNews(parseBody(event));
    }
    if (route.action === 'uploadNewsCover') {
      return uploadNewsCoverFromEvent(event);
    }
    return updateTask(route.orderNo as string, parseBody(event), event);
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
    console.error(JSON.stringify({
      tag: 'operator.api.error',
      statusCode,
      message: error instanceof Error ? error.message : String(error),
    }));
    return fail(statusCode, error instanceof Error ? error.message : '运营接口异常');
  }
}
