"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseXStatusId = parseXStatusId;
exports.selectBestXMp4Variant = selectBestXMp4Variant;
exports.selectSmallestXMp4Variant = selectSmallestXMp4Variant;
exports.selectXVideoMedia = selectXVideoMedia;
function parseXStatusId(value) {
    let url;
    try {
        url = new URL(value.trim());
    }
    catch (_a) {
        throw new Error('X 视频链接格式不正确');
    }
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'x.com' && hostname !== 'twitter.com') {
        throw new Error('仅支持 x.com/twitter.com 链接');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const statusIndex = parts.findIndex((part) => part === 'status' || part === 'statuses');
    const statusId = statusIndex >= 0 ? parts[statusIndex + 1] : '';
    if (!statusId || !/^\d{5,30}$/.test(statusId)) {
        throw new Error('未识别到 X 帖子 ID');
    }
    return statusId;
}
function selectBestXMp4Variant(variants) {
    var _a;
    const mp4Variants = variants
        .filter((variant) => (variant.content_type === 'video/mp4'
        && typeof variant.url === 'string'
        && /^https:\/\//.test(variant.url)))
        .sort((left, right) => { var _a, _b; return Number((_a = right.bit_rate) !== null && _a !== void 0 ? _a : 0) - Number((_b = left.bit_rate) !== null && _b !== void 0 ? _b : 0); });
    return (_a = mp4Variants[0]) !== null && _a !== void 0 ? _a : null;
}
function selectSmallestXMp4Variant(variants) {
    var _a;
    const mp4Variants = variants
        .filter((variant) => (variant.content_type === 'video/mp4'
        && typeof variant.url === 'string'
        && /^https:\/\//.test(variant.url)))
        .sort((left, right) => { var _a, _b; return Number((_a = left.bit_rate) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER) - Number((_b = right.bit_rate) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER); });
    return (_a = mp4Variants[0]) !== null && _a !== void 0 ? _a : null;
}
function selectXVideoMedia(media) {
    var _a;
    const videos = media.filter((item) => item.type === 'video' || item.type === 'animated_gif');
    return (_a = videos.find((item) => { var _a; return selectBestXMp4Variant((_a = item.variants) !== null && _a !== void 0 ? _a : []); })) !== null && _a !== void 0 ? _a : null;
}
