"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const wechat_pay_v3_1 = require("./shared/wechat-pay-v3");
function errorResponse(message) {
    return {
        code: 400,
        message,
        data: null,
    };
}
function appendDownloadQuery(url, params) {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
        if (value && !parsed.searchParams.has(key)) {
            parsed.searchParams.set(key, value);
        }
    });
    return parsed.toString();
}
function requireDownloadParam(value, label) {
    if (!value) {
        throw new Error(`发票下载参数不完整：缺少${label}`);
    }
    return value;
}
async function getFapiaoFile(event = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const invoiceNo = (_a = event.invoiceNo) === null || _a === void 0 ? void 0 : _a.trim();
    if (!invoiceNo) {
        throw new Error('缺少发票申请号');
    }
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('请先登录');
    }
    const invoice = await (0, db_1.getInvoiceRequestByNo)(invoiceNo);
    if (!invoice || invoice.userId !== user._id) {
        throw new Error('发票申请不存在');
    }
    if (invoice.status !== 'issued') {
        throw new Error('发票尚未开具完成');
    }
    if (invoice.invoiceFileId) {
        return (0, utils_1.ok)({ fileId: invoice.invoiceFileId });
    }
    if (invoice.invoiceFileUrl) {
        return (0, utils_1.ok)({ fileId: '', fileUrl: invoice.invoiceFileUrl });
    }
    if (!invoice.fapiaoApplyId || !invoice.fapiaoId) {
        throw new Error('发票下载参数不完整');
    }
    const config = (0, wechat_pay_v3_1.getWechatPayV3Config)();
    const path = `/v3/new-tax-control-fapiao/fapiao-applications/${encodeURIComponent(invoice.fapiaoApplyId)}/fapiao-files?fapiao_id=${encodeURIComponent(invoice.fapiaoId)}`;
    const response = await (0, wechat_pay_v3_1.requestWechatPayV3)(config, {
        method: 'GET',
        path,
    });
    if (response.statusCode !== 200 || !response.data) {
        throw new Error(`获取发票下载信息失败：${response.statusCode}`);
    }
    const downloadInfo = (_c = (_b = response.data.fapiao_download_info_list) === null || _b === void 0 ? void 0 : _b.find((item) => item.fapiao_id === invoice.fapiaoId)) !== null && _c !== void 0 ? _c : (_d = response.data.fapiao_download_info_list) === null || _d === void 0 ? void 0 : _d[0];
    if (!(downloadInfo === null || downloadInfo === void 0 ? void 0 : downloadInfo.download_url) || downloadInfo.status !== 'ISSUED') {
        throw new Error('发票文件暂不可下载');
    }
    const cardOpenid = requireDownloadParam(invoice.cardOpenid, 'card_openid');
    const invoiceCode = requireDownloadParam(invoice.invoiceCode, 'invoice_code');
    const invoiceNumber = requireDownloadParam((_e = invoice.invoiceNumber) !== null && _e !== void 0 ? _e : invoice.invoiceNoFromWechat, 'invoice_no');
    const downloadUrl = appendDownloadQuery(downloadInfo.download_url, {
        mchid: config.mchId,
        openid: cardOpenid,
        invoice_code: invoiceCode,
        invoice_no: invoiceNumber,
        fapiao_id: invoice.fapiaoId,
    });
    const file = await (0, wechat_pay_v3_1.downloadWechatPayFile)(downloadUrl);
    const contentDisposition = String((_f = file.headers['content-disposition']) !== null && _f !== void 0 ? _f : '');
    const ext = contentDisposition.includes('.ofd') ? 'ofd' : 'pdf';
    const cloudPath = `invoices/${user._id}/${invoice.invoiceNo}.${ext}`;
    const upload = await db_1.app.uploadFile({
        cloudPath,
        fileContent: file.content,
    });
    const now = Date.now();
    await (0, db_1.collection)('invoiceRequests').doc(invoice._id).update({
        data: {
            invoiceFileId: upload.fileID,
            invoiceDownloadUrl: downloadInfo.download_url,
            invoiceDownloadUrlExpireAt: now + 30 * 1000,
            sm3Digest: String((_g = file.headers['sm3-digest']) !== null && _g !== void 0 ? _g : ''),
            updatedAt: now,
        },
    });
    return (0, utils_1.ok)({ fileId: upload.fileID });
}
async function main(event = {}) {
    try {
        return await getFapiaoFile(event);
    }
    catch (error) {
        return errorResponse(error instanceof Error ? error.message : '获取发票文件失败');
    }
}
