import cloud from 'wx-server-sdk';
import crypto from 'crypto';
import https from 'https';
import { DEFAULT_PRODUCT_NAME } from './constants';
import type { OrderRecord } from './types';
import { toWechatPaymentAmount } from './utils';

interface WechatPhoneInfo {
  phoneNumber?: string;
  purePhoneNumber?: string;
  countryCode?: string;
}

interface WechatPhoneResult {
  phone_info?: WechatPhoneInfo;
  phoneInfo?: WechatPhoneInfo;
}

interface CloudOpenApiClient {
  openapi?: {
    phonenumber?: {
      getPhoneNumber(params: { code: string }): Promise<WechatPhoneResult>;
    };
  };
}

interface UnifiedOrderParams {
  body: string;
  outTradeNo: string;
  totalFee: number;
  envId: string;
  functionName: string;
  spbillCreateIp: string;
  attach?: string;
}

interface UnifiedOrderResult {
  returnCode?: string;
  resultCode?: string;
  returnMsg?: string;
  errCode?: string;
  errCodeDes?: string;
  payment?: {
    appId?: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'MD5' | 'RSA';
    paySign: string;
  };
  payInfo?: {
    appId?: string;
    timeStamp?: string;
    nonceStr?: string;
    package?: string;
    packageVal?: string;
    signType?: 'MD5' | 'RSA';
    paySign?: string;
  };
}

interface RawWechatPaymentParams {
  appId?: string;
  timeStamp?: string;
  nonceStr?: string;
  package?: string;
  packageVal?: string;
  signType?: 'MD5' | 'RSA';
  paySign?: string;
}

interface WechatPaymentParams {
  appId?: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'MD5' | 'RSA';
  paySign: string;
}

interface CloudPayClient {
  cloudPay?: {
    unifiedOrder(params: UnifiedOrderParams): Promise<UnifiedOrderResult>;
  };
}

export interface WechatPayConfig {
  envId: string;
  notifyFunctionName: string;
  spbillCreateIp: string;
}

interface WechatPayV2Config {
  appid: string;
  mchId: string;
  apiKey: string;
  notifyUrl: string;
  spbillCreateIp: string;
}

interface WechatPayV2UnifiedOrderResult {
  return_code?: string;
  return_msg?: string;
  result_code?: string;
  err_code?: string;
  err_code_des?: string;
  prepay_id?: string;
  trade_type?: string;
}

interface WechatPayHttpResponse {
  statusCode?: number;
  body: string;
}

export interface WechatPayV2Notify {
  return_code?: string;
  return_msg?: string;
  result_code?: string;
  err_code?: string;
  err_code_des?: string;
  appid?: string;
  mch_id?: string;
  openid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  total_fee?: string;
  time_end?: string;
  sign?: string;
}

function normalizeWechatPaymentParams(result: UnifiedOrderResult): WechatPaymentParams | null {
  const candidate = (result.payment ?? result.payInfo) as RawWechatPaymentParams | undefined;
  if (!candidate) {
    return null;
  }

  const packageValue = candidate.package ?? candidate.packageVal;
  if (!candidate.timeStamp || !candidate.nonceStr || !packageValue || !candidate.signType || !candidate.paySign) {
    return null;
  }

  return {
    appId: candidate.appId,
    timeStamp: candidate.timeStamp,
    nonceStr: candidate.nonceStr,
    package: packageValue,
    signType: candidate.signType,
    paySign: candidate.paySign,
  };
}

function formatUnifiedOrderError(result: UnifiedOrderResult): string {
  const keys = Object.keys(result || {}).sort().join(',') || 'none';
  const parts = [
    `returnCode=${result.returnCode ?? 'unknown'}`,
    `resultCode=${result.resultCode ?? 'unknown'}`,
  ];

  if (result.returnMsg) {
    parts.push(`returnMsg=${result.returnMsg}`);
  }
  if (result.errCode) {
    parts.push(`errCode=${result.errCode}`);
  }
  if (result.errCodeDes) {
    parts.push(`errCodeDes=${result.errCodeDes}`);
  }

  parts.push(`keys=${keys}`);
  return parts.join('; ');
}

export function getWechatPayConfig(): WechatPayConfig {
  const envId = process.env.WX_PAY_ENV_ID || process.env.TCB_ENV || process.env.SCF_NAMESPACE || '';
  const notifyFunctionName = process.env.WX_PAY_NOTIFY_FUNCTION || 'pay-notify';
  const spbillCreateIp = process.env.WX_PAY_SPBILL_CREATE_IP || '127.0.0.1';

  if (!envId) {
    throw new Error('缺少支付环境配置：请设置 WX_PAY_ENV_ID 或云函数环境 ID');
  }

  return {
    envId,
    notifyFunctionName,
    spbillCreateIp,
  };
}

export function getWechatPayV2Config(): WechatPayV2Config {
  const appid = process.env.WX_PAY_APPID || '';
  const mchId = process.env.WX_PAY_MCH_ID || '';
  const apiKey = process.env.WX_PAY_API_KEY || '';
  const notifyUrl = process.env.WX_PAY_NOTIFY_URL || '';
  const spbillCreateIp = process.env.WX_PAY_SPBILL_CREATE_IP || '127.0.0.1';

  const missing = [
    !appid && 'WX_PAY_APPID',
    !mchId && 'WX_PAY_MCH_ID',
    !apiKey && 'WX_PAY_API_KEY',
    !notifyUrl && 'WX_PAY_NOTIFY_URL',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`缺少微信支付 V2 配置：${missing.join(', ')}`);
  }

  return {
    appid,
    mchId,
    apiKey,
    notifyUrl,
    spbillCreateIp,
  };
}

export function getWechatPayV2ApiKey(): string {
  const apiKey = process.env.WX_PAY_API_KEY || '';
  if (!apiKey) {
    throw new Error('缺少微信支付 V2 配置：WX_PAY_API_KEY');
  }

  return apiKey;
}

function createNonceStr(): string {
  return crypto.randomBytes(16).toString('hex');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function signWechatPayV2(params: Record<string, string | number | undefined>, apiKey: string): string {
  const payload = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && value !== undefined && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto
    .createHash('md5')
    .update(`${payload}&key=${apiKey}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

function buildWechatPayXml(params: Record<string, string | number | undefined>): string {
  const body = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `<${key}>${escapeXml(String(value))}</${key}>`)
    .join('');
  return `<xml>${body}</xml>`;
}

export function parseWechatPayXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const content = xml.trim().replace(/^<xml>/, '').replace(/<\/xml>$/, '');
  const pattern = /<([a-zA-Z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    result[match[1]] = match[2] ?? match[3] ?? '';
  }
  return result;
}

function postWechatPayXml(url: string, xml: string): Promise<WechatPayHttpResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(xml),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () =>
          resolve({
            statusCode: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );

    request.on('error', reject);
    request.write(xml);
    request.end();
  });
}

export function buildWechatPayNotifyResponse(returnCode: 'SUCCESS' | 'FAIL', returnMsg: string): string {
  return buildWechatPayXml({
    return_code: returnCode,
    return_msg: returnMsg,
  });
}

export function verifyWechatPayV2Sign(params: Record<string, string>, apiKey = getWechatPayV2ApiKey()): boolean {
  if (!params.sign) {
    return false;
  }

  return signWechatPayV2(params, apiKey) === params.sign;
}

export class WechatPayV2OrderError extends Error {
  constructor(
    message: string,
    public readonly errCode?: string,
    public readonly errCodeDes?: string,
  ) {
    super(message);
    this.name = 'WechatPayV2OrderError';
  }
}

export async function createWechatPayV2Order(
  order: OrderRecord,
  openid: string,
): Promise<WechatPaymentParams & { prepayId: string }> {
  const config = getWechatPayV2Config();
  const requestParams = {
    appid: config.appid,
    mch_id: config.mchId,
    nonce_str: createNonceStr(),
    body: `${order.productName || DEFAULT_PRODUCT_NAME}-${order.planName}`,
    out_trade_no: order.orderNo,
    total_fee: toWechatPaymentAmount(order.amount),
    spbill_create_ip: config.spbillCreateIp,
    notify_url: config.notifyUrl,
    trade_type: 'JSAPI',
    openid,
    attach: JSON.stringify({
      orderNo: order.orderNo,
      productCode: order.productCode,
      planCode: order.planCode,
      userId: order.userId,
    }),
  };
  const sign = signWechatPayV2(requestParams, config.apiKey);
  const httpResponse = await postWechatPayXml('https://api.mch.weixin.qq.com/pay/unifiedorder', buildWechatPayXml({
    ...requestParams,
    sign,
  }));
  const response = parseWechatPayXml(httpResponse.body) as WechatPayV2UnifiedOrderResult;
  const rawResponse = httpResponse.body.replace(/\s+/g, ' ').slice(0, 300);

  console.log(
    JSON.stringify({
      tag: 'wechatPay.v2.unifiedorder',
      orderNo: order.orderNo,
      appid: config.appid,
      mchId: config.mchId,
      notifyUrl: config.notifyUrl,
      openidPrefix: openid.slice(0, 6),
      totalFee: requestParams.total_fee,
      statusCode: httpResponse.statusCode,
      response,
      rawResponse,
    }),
  );

  if (response.return_code !== 'SUCCESS' || response.result_code !== 'SUCCESS' || !response.prepay_id) {
    throw new WechatPayV2OrderError(
      `微信支付 V2 统一下单失败: return_code=${response.return_code ?? 'unknown'}; result_code=${
        response.result_code ?? 'unknown'
      }; return_msg=${response.return_msg ?? ''}; err_code=${response.err_code ?? ''}; err_code_des=${
        response.err_code_des ?? ''
      }; http_status=${httpResponse.statusCode ?? 'unknown'}; raw=${rawResponse}`,
      response.err_code,
      response.err_code_des,
    );
  }

  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = createNonceStr();
  const paymentPackage = `prepay_id=${response.prepay_id}`;
  const payment = {
    appId: config.appid,
    timeStamp,
    nonceStr,
    package: paymentPackage,
    signType: 'MD5' as const,
    paySign: signWechatPayV2(
      {
        appId: config.appid,
        timeStamp,
        nonceStr,
        package: paymentPackage,
        signType: 'MD5',
      },
      config.apiKey,
    ),
    prepayId: response.prepay_id,
  };

  return payment;
}

export async function getWechatPhoneNumber(code: string): Promise<string> {
  const sdk = cloud as unknown as CloudOpenApiClient;
  const phoneApi = sdk.openapi?.phonenumber;
  if (!phoneApi) {
    throw new Error('当前云函数环境未启用 openapi.phonenumber.getPhoneNumber');
  }

  const result = await phoneApi.getPhoneNumber({ code });
  const phoneInfo = result.phone_info ?? result.phoneInfo;
  const mobile = phoneInfo?.purePhoneNumber ?? phoneInfo?.phoneNumber ?? '';
  if (!mobile) {
    throw new Error('微信未返回手机号');
  }

  return mobile;
}

export async function createWechatPayOrder(order: OrderRecord): Promise<WechatPaymentParams> {
  const sdk = cloud as unknown as CloudPayClient;
  const cloudPay = sdk.cloudPay;
  if (!cloudPay) {
    throw new Error('当前云函数环境未启用 cloud.cloudPay.unifiedOrder');
  }

  const config = getWechatPayConfig();
  const result = await cloudPay.unifiedOrder({
    body: `${order.productName || DEFAULT_PRODUCT_NAME}-${order.planName}`,
    outTradeNo: order.orderNo,
    totalFee: toWechatPaymentAmount(order.amount),
    envId: config.envId,
    functionName: config.notifyFunctionName,
    spbillCreateIp: config.spbillCreateIp,
    attach: JSON.stringify({
      orderNo: order.orderNo,
      productCode: order.productCode,
      planCode: order.planCode,
      userId: order.userId,
    }),
  });

  console.log(
    JSON.stringify({
      tag: 'cloudPay.unifiedOrder',
      orderNo: order.orderNo,
      productCode: order.productCode,
      totalFee: toWechatPaymentAmount(order.amount),
      result,
    }),
  );

  const payment = normalizeWechatPaymentParams(result);
  if (!payment) {
    throw new Error(`统一下单未返回可用支付参数: ${formatUnifiedOrderError(result)}`);
  }

  return payment;
}
