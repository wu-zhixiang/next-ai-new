"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ok = ok;
exports.calcRemainDays = calcRemainDays;
exports.calcMembershipRemainDays = calcMembershipRemainDays;
exports.calcExpireTag = calcExpireTag;
exports.normalizeMembership = normalizeMembership;
exports.getMembershipOpenStatusLabel = getMembershipOpenStatusLabel;
exports.createOrderNo = createOrderNo;
exports.maskMobile = maskMobile;
exports.isValidMainlandMobile = isValidMainlandMobile;
exports.normalizeMobile = normalizeMobile;
exports.toWechatPaymentAmount = toWechatPaymentAmount;
exports.parseWechatPayTime = parseWechatPayTime;
exports.getPendingOrderExpireAt = getPendingOrderExpireAt;
exports.isPendingOrderExpired = isPendingOrderExpired;
const constants_1 = require("./constants");
const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_ORDER_TTL_MS = 30 * 60 * 1000;
function ok(data, message = 'ok') {
    return {
        code: constants_1.SUCCESS_CODE,
        message,
        data,
    };
}
function calcRemainDays(endAt, now = Date.now()) {
    return Math.max(0, Math.ceil((endAt - now) / DAY_MS));
}
function getPlanDurationCap(planCode) {
    if (planCode === 'monthly')
        return 30;
    if (planCode === 'quarterly')
        return 90;
    if (planCode === 'annual')
        return 365;
    return undefined;
}
function calcMembershipRemainDays(record, now = Date.now()) {
    const remainDays = calcRemainDays(record.endAt, now);
    const durationCap = getPlanDurationCap(record.planCode);
    return durationCap ? Math.min(remainDays, durationCap) : remainDays;
}
function calcExpireTag(endAt, now = Date.now()) {
    if (endAt < now) {
        return 'expired';
    }
    const remainDays = calcRemainDays(endAt, now);
    if (remainDays <= 3) {
        return 'within_3d';
    }
    if (remainDays <= 7) {
        return 'within_7d';
    }
    if (remainDays <= 30) {
        return 'within_30d';
    }
    return 'normal';
}
function normalizeMembership(record) {
    if (!record) {
        return {
            status: 'none',
            openStatusLabel: getMembershipOpenStatusLabel('none'),
        };
    }
    return {
        status: record.status,
        openStatusLabel: getMembershipOpenStatusLabel(record.status),
        productCode: record.productCode,
        productName: record.productName,
        planName: record.planName,
        startAt: record.startAt,
        endAt: record.endAt,
        remainDays: calcMembershipRemainDays(record),
    };
}
function getMembershipOpenStatusLabel(status) {
    if (status === 'active') {
        return '已开通';
    }
    if (status === 'none') {
        return '立即开通';
    }
    return '开通中';
}
function createOrderNo(prefix = 'ORD') {
    const time = Date.now().toString();
    const random = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');
    return `${prefix}${time}${random}`;
}
function maskMobile(mobile) {
    if (!mobile) {
        return '';
    }
    const normalized = mobile.replace(/\s+/g, '');
    if (/^\d{11}$/.test(normalized)) {
        return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
    }
    return mobile;
}
function isValidMainlandMobile(mobile) {
    if (!mobile) {
        return false;
    }
    return /^1\d{10}$/.test(mobile.replace(/\s+/g, ''));
}
function normalizeMobile(mobile) {
    var _a;
    return (_a = mobile === null || mobile === void 0 ? void 0 : mobile.replace(/\s+/g, '')) !== null && _a !== void 0 ? _a : '';
}
function toWechatPaymentAmount(amount) {
    return Math.round(amount * 100);
}
function parseWechatPayTime(value) {
    if (!value || !/^\d{14}$/.test(value)) {
        return Date.now();
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const hour = Number(value.slice(8, 10));
    const minute = Number(value.slice(10, 12));
    const second = Number(value.slice(12, 14));
    return new Date(year, month, day, hour, minute, second).getTime();
}
function getPendingOrderExpireAt(createdAt, payExpireAt, lastPayAttemptAt) {
    return payExpireAt !== null && payExpireAt !== void 0 ? payExpireAt : (lastPayAttemptAt ? lastPayAttemptAt + PENDING_ORDER_TTL_MS : createdAt + PENDING_ORDER_TTL_MS);
}
function isPendingOrderExpired(createdAt, now = Date.now(), payExpireAt, lastPayAttemptAt) {
    return now > getPendingOrderExpireAt(createdAt, payExpireAt, lastPayAttemptAt);
}
