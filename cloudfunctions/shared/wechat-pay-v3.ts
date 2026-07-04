import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';

export interface WechatPayV3Config {
  mchId: string;
  merchantSerialNo: string;
  privateKey: string;
  publicKeyId?: string;
  publicKey?: string;
}

export interface WechatPayV3RequestOptions {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface WechatPayV3Response<T = unknown> {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  data: T | null;
  rawBody: string;
}

export interface WechatPayEncryptedResource {
  algorithm?: string;
  ciphertext?: string;
  associated_data?: string;
  nonce?: string;
}

export function getWechatPayV3Config(): WechatPayV3Config {
  const mchId = process.env.WECHAT_PAY_MCH_ID || process.env.WX_PAY_MCH_ID || '';
  const merchantSerialNo = process.env.WECHAT_PAY_MERCHANT_SERIAL_NO || '';
  const privateKey = normalizePrivateKey(process.env.WECHAT_PAY_PRIVATE_KEY || '');
  const publicKeyId = process.env.WECHAT_PAY_PUBLIC_KEY_ID || '';
  const publicKey = normalizePublicKey(process.env.WECHAT_PAY_PUBLIC_KEY || '');
  const missing = [
    !mchId && 'WECHAT_PAY_MCH_ID',
    !merchantSerialNo && 'WECHAT_PAY_MERCHANT_SERIAL_NO',
    !privateKey && 'WECHAT_PAY_PRIVATE_KEY',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`缺少微信支付 API v3 配置：${missing.join(', ')}`);
  }
  assertPemKey('WECHAT_PAY_PRIVATE_KEY', privateKey, ['PRIVATE KEY', 'RSA PRIVATE KEY']);
  if (publicKey) {
    assertPemKey('WECHAT_PAY_PUBLIC_KEY', publicKey, ['PUBLIC KEY']);
  }
  return { mchId, merchantSerialNo, privateKey, publicKeyId, publicKey };
}

export function hasWechatPayV3Config(): boolean {
  try {
    getWechatPayV3Config();
    return true;
  } catch {
    return false;
  }
}

export function getWechatPayPublicKeySerial(config: WechatPayV3Config): string {
  if (!config.publicKey || !config.publicKeyId) {
    throw new Error('缺少微信支付公钥配置：WECHAT_PAY_PUBLIC_KEY_ID / WECHAT_PAY_PUBLIC_KEY');
  }
  return config.publicKeyId;
}

export function encryptWechatPaySensitiveField(value: string, config: WechatPayV3Config): string {
  if (!value) {
    return '';
  }
  if (!config.publicKey) {
    throw new Error('缺少微信支付公钥配置：WECHAT_PAY_PUBLIC_KEY');
  }
  return crypto.publicEncrypt(
    {
      key: config.publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1',
    },
    Buffer.from(value, 'utf8'),
  ).toString('base64');
}

export function verifyWechatPayV3Signature(params: {
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  serial: string;
  config: WechatPayV3Config;
}): boolean {
  if (!params.config.publicKey || params.serial !== params.config.publicKeyId) {
    return false;
  }
  if (params.signature.startsWith('WECHATPAY/SIGNTEST/')) {
    return false;
  }
  const message = `${params.timestamp}\n${params.nonce}\n${params.body}\n`;
  return crypto
    .createVerify('RSA-SHA256')
    .update(message, 'utf8')
    .verify(params.config.publicKey, params.signature, 'base64');
}

export function decryptWechatPayResource<T = unknown>(
  resource: WechatPayEncryptedResource,
  apiV3Key = process.env.WECHAT_PAY_API_V3_KEY || '',
): T {
  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('不支持的微信支付回调加密算法');
  }
  if (!apiV3Key) {
    throw new Error('缺少微信支付 API v3 密钥：WECHAT_PAY_API_V3_KEY');
  }
  if (Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
    throw new Error('微信支付 API v3 密钥长度必须为 32 字节');
  }
  if (!resource.ciphertext || !resource.nonce) {
    throw new Error('微信支付回调密文参数不完整');
  }
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(resource.nonce, 'utf8'));
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  }
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as T;
}

export async function requestWechatPayV3<T = unknown>(
  config: WechatPayV3Config,
  options: WechatPayV3RequestOptions,
): Promise<WechatPayV3Response<T>> {
  const body = options.body === undefined ? '' : JSON.stringify(options.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = signWechatPayV3({
    method: options.method,
    path: options.path,
    timestamp,
    nonce,
    body,
    privateKey: config.privateKey,
  });
  const authorization = `WECHATPAY2-SHA256-RSA2048 ${[
    `mchid="${config.mchId}"`,
    `nonce_str="${nonce}"`,
    `signature="${signature}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${config.merchantSerialNo}"`,
  ].join(',')}`;

  return requestJson<T>({
    method: options.method,
    hostname: 'api.mch.weixin.qq.com',
    path: options.path,
    body,
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'gpt-pay-miniapp/1.0 WeChatPay-APIv3',
      ...(options.headers ?? {}),
    },
  });
}

export function downloadWechatPayFile(url: string): Promise<{
  content: Buffer;
  headers: Record<string, string | string[] | undefined>;
}> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get(parsed, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const content = Buffer.concat(chunks);
        const contentType = String(response.headers['content-type'] ?? '');
        if ((response.statusCode ?? 0) >= 400 || contentType.includes('application/json')) {
          reject(new Error(content.toString('utf8') || `下载发票文件失败：${response.statusCode}`));
          return;
        }
        resolve({ content, headers: response.headers });
      });
    }).on('error', reject);
  });
}

function signWechatPayV3(params: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
  privateKey: string;
}): string {
  const message = `${params.method}\n${params.path}\n${params.timestamp}\n${params.nonce}\n${params.body}\n`;
  return crypto
    .createSign('RSA-SHA256')
    .update(message, 'utf8')
    .sign(params.privateKey, 'base64');
}

function requestJson<T>(options: {
  method: 'GET' | 'POST' | 'PATCH';
  hostname: string;
  path: string;
  body: string;
  headers: Record<string, string>;
}): Promise<WechatPayV3Response<T>> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: options.hostname,
        path: options.path,
        method: options.method,
        headers: {
          ...options.headers,
          'Content-Length': Buffer.byteLength(options.body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let data: T | null = null;
          if (rawBody) {
            try {
              data = JSON.parse(rawBody) as T;
            } catch {
              data = null;
            }
          }
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            data,
            rawBody,
          });
        });
      },
    );
    request.on('error', reject);
    request.write(options.body);
    request.end();
  });
}

export function getWechatPayHeader(headers: Record<string, string | undefined> | undefined, name: string): string {
  const target = name.toLowerCase();
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === target)?.[1] ?? '';
}

function normalizePrivateKey(value: string): string {
  const trimmed = trimEnvValue(value);
  return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}

function normalizePublicKey(value: string): string {
  const trimmed = trimEnvValue(value);
  return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}

function trimEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function assertPemKey(envName: string, value: string, allowedLabels: string[]): void {
  const startsWithAllowedLabel = allowedLabels.some((label) => value.startsWith(`-----BEGIN ${label}-----`));
  const endsWithAllowedLabel = allowedLabels.some((label) => value.endsWith(`-----END ${label}-----`));
  if (!startsWithAllowedLabel || !endsWithAllowedLabel) {
    throw new Error(`${envName} 格式错误：请填写 PEM 内容本身，不要填写文件路径；首尾应包含 ${allowedLabels.map((label) => `-----BEGIN ${label}-----`).join(' 或 ')}`);
  }
}
