"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePaymentType = normalizePaymentType;
exports.paymentTypeToPayChannel = paymentTypeToPayChannel;
function normalizePaymentType(value) {
    return value === 'standard' ? 'standard' : 'virtual';
}
function paymentTypeToPayChannel(paymentType) {
    return paymentType === 'standard' ? 'wechat_pay' : 'wechat_virtual_pay';
}
