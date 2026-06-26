"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN = void 0;
exports.normalizeAiAccountEmailDomain = normalizeAiAccountEmailDomain;
exports.isValidAiAccountEmailDomain = isValidAiAccountEmailDomain;
exports.selectAvailableAiAccountEmailDomain = selectAvailableAiAccountEmailDomain;
exports.getAiAccountEmailSuffix = getAiAccountEmailSuffix;
exports.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN = 'mraclpivot.com';
function normalizeAiAccountEmailDomain(value) {
    return (value !== null && value !== void 0 ? value : '').trim().toLowerCase().replace(/^@+/, '');
}
function isValidAiAccountEmailDomain(value) {
    const domain = normalizeAiAccountEmailDomain(value);
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}
function selectAvailableAiAccountEmailDomain(domains) {
    const matched = domains
        .filter((item) => item.available === true && item.status !== 'off' && isValidAiAccountEmailDomain(item.domain))
        .sort((left, right) => { var _a, _b; return ((_a = left.sort) !== null && _a !== void 0 ? _a : 9999) - ((_b = right.sort) !== null && _b !== void 0 ? _b : 9999); })[0];
    return matched ? normalizeAiAccountEmailDomain(matched.domain) : null;
}
function getAiAccountEmailSuffix(domain) {
    return `@${normalizeAiAccountEmailDomain(domain) || exports.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN}`;
}
