import { app, collection, getInvoiceRequestByNo, getUserByOpenId } from '../shared/db';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';
import {
  downloadWechatPayFile,
  getWechatPayV3Config,
  requestWechatPayV3,
} from '../shared/wechat-pay-v3';

interface Event {
  invoiceNo?: string;
}

interface FapiaoDownloadInfoResponse {
  fapiao_download_info_list?: Array<{
    fapiao_id?: string;
    download_url?: string;
    status?: string;
  }>;
}

function errorResponse(message: string) {
  return {
    code: 400,
    message,
    data: null,
  };
}

function appendDownloadQuery(url: string, params: Record<string, string | undefined>): string {
  const parsed = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value && !parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, value);
    }
  });
  return parsed.toString();
}

function requireDownloadParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`发票下载参数不完整：缺少${label}`);
  }
  return value;
}

async function getFapiaoFile(event: Event = {}) {
  const invoiceNo = event.invoiceNo?.trim();
  if (!invoiceNo) {
    throw new Error('缺少发票申请号');
  }
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('请先登录');
  }
  const invoice = await getInvoiceRequestByNo(invoiceNo);
  if (!invoice || invoice.userId !== user._id) {
    throw new Error('发票申请不存在');
  }
  if (invoice.status !== 'issued') {
    throw new Error('发票尚未开具完成');
  }
  if (invoice.invoiceFileId) {
    return ok({ fileId: invoice.invoiceFileId });
  }
  if (invoice.invoiceFileUrl) {
    return ok({ fileId: '', fileUrl: invoice.invoiceFileUrl });
  }
  if (!invoice.fapiaoApplyId || !invoice.fapiaoId) {
    throw new Error('发票下载参数不完整');
  }

  const config = getWechatPayV3Config();
  const path = `/v3/new-tax-control-fapiao/fapiao-applications/${encodeURIComponent(invoice.fapiaoApplyId)}/fapiao-files?fapiao_id=${encodeURIComponent(invoice.fapiaoId)}`;
  const response = await requestWechatPayV3<FapiaoDownloadInfoResponse>(config, {
    method: 'GET',
    path,
  });
  if (response.statusCode !== 200 || !response.data) {
    throw new Error(`获取发票下载信息失败：${response.statusCode}`);
  }
  const downloadInfo = response.data.fapiao_download_info_list?.find((item) => item.fapiao_id === invoice.fapiaoId)
    ?? response.data.fapiao_download_info_list?.[0];
  if (!downloadInfo?.download_url || downloadInfo.status !== 'ISSUED') {
    throw new Error('发票文件暂不可下载');
  }
  const cardOpenid = requireDownloadParam(invoice.cardOpenid, 'card_openid');
  const invoiceCode = requireDownloadParam(invoice.invoiceCode, 'invoice_code');
  const invoiceNumber = requireDownloadParam(invoice.invoiceNumber ?? invoice.invoiceNoFromWechat, 'invoice_no');
  const downloadUrl = appendDownloadQuery(downloadInfo.download_url, {
    mchid: config.mchId,
    openid: cardOpenid,
    invoice_code: invoiceCode,
    invoice_no: invoiceNumber,
    fapiao_id: invoice.fapiaoId,
  });
  const file = await downloadWechatPayFile(downloadUrl);
  const contentDisposition = String(file.headers['content-disposition'] ?? '');
  const ext = contentDisposition.includes('.ofd') ? 'ofd' : 'pdf';
  const cloudPath = `invoices/${user._id}/${invoice.invoiceNo}.${ext}`;
  const upload = await app.uploadFile({
    cloudPath,
    fileContent: file.content,
  });
  const now = Date.now();
  await collection('invoiceRequests').doc(invoice._id).update({
    data: {
      invoiceFileId: upload.fileID,
      invoiceDownloadUrl: downloadInfo.download_url,
      invoiceDownloadUrlExpireAt: now + 30 * 1000,
      sm3Digest: String(file.headers['sm3-digest'] ?? ''),
      updatedAt: now,
    },
  });

  return ok({ fileId: upload.fileID });
}

export async function main(event: Event = {}) {
  try {
    return await getFapiaoFile(event);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '获取发票文件失败');
  }
}
