"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports._ = exports.db = exports.app = void 0;
exports.collection = collection;
exports.ensureCollection = ensureCollection;
exports.getUserByOpenId = getUserByOpenId;
exports.getUserById = getUserById;
exports.getUserByInviteCode = getUserByInviteCode;
exports.getUserByAiAccountEmail = getUserByAiAccountEmail;
exports.getMembershipByUserId = getMembershipByUserId;
exports.listMembershipsByUserId = listMembershipsByUserId;
exports.getDeliveryByUserId = getDeliveryByUserId;
exports.getPlanByCode = getPlanByCode;
exports.getOrderByNo = getOrderByNo;
exports.getLatestPendingOrderByUserId = getLatestPendingOrderByUserId;
exports.listOrdersByUserId = listOrdersByUserId;
exports.listPendingOrdersByUserId = listPendingOrdersByUserId;
exports.listInviteRelationsByInviterId = listInviteRelationsByInviterId;
exports.getLatestEmailVerificationCode = getLatestEmailVerificationCode;
exports.getLatestUnusedEmailVerificationCode = getLatestUnusedEmailVerificationCode;
exports.getLatestAppStoreEmailVerificationCode = getLatestAppStoreEmailVerificationCode;
exports.getLatestUnusedAppStoreEmailVerificationCode = getLatestUnusedAppStoreEmailVerificationCode;
const wx_server_sdk_1 = __importDefault(require("wx-server-sdk"));
const constants_1 = require("./constants");
wx_server_sdk_1.default.init({
    env: wx_server_sdk_1.default.DYNAMIC_CURRENT_ENV,
});
exports.app = wx_server_sdk_1.default;
exports.db = wx_server_sdk_1.default.database();
exports._ = exports.db.command;
function collection(name) {
    return exports.db.collection(constants_1.COLLECTIONS[name]);
}
async function ensureCollection(name) {
    const target = constants_1.COLLECTIONS[name];
    try {
        await exports.db.createCollection(target);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('already exists')
            && !message.includes('Collection already exists')
            && !message.includes('already exist')
            && !message.includes('DATABASE_COLLECTION_ALREADY_EXIST')
            && !message.includes('ResourceExist')
            && !message.includes('Table exist')) {
            throw error;
        }
    }
}
async function getUserByOpenId(openid) {
    var _a;
    const result = await collection('users').where({ openid }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getUserById(userId) {
    var _a;
    const result = await collection('users').doc(userId).get();
    return (_a = result.data) !== null && _a !== void 0 ? _a : null;
}
async function getUserByInviteCode(inviteCode) {
    var _a;
    const result = await collection('users').where({ inviteCode }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getUserByAiAccountEmail(email) {
    var _a;
    const result = await collection('users').where({ aiAccountEmail: email.toLowerCase() }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getMembershipByUserId(userId, productCode) {
    var _a;
    const query = productCode ? { userId, productCode } : { userId };
    const result = await collection('memberships').where(query).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function listMembershipsByUserId(userId) {
    const result = await collection('memberships').where({ userId }).get();
    return result.data;
}
async function getDeliveryByUserId(userId) {
    var _a;
    const result = await collection('deliveries').where({ userId }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getPlanByCode(planCode) {
    var _a;
    const result = await collection('memberPlans').where({ planCode, status: 'on' }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getOrderByNo(orderNo) {
    var _a;
    const result = await collection('orders').where({ orderNo }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function getLatestPendingOrderByUserId(userId, productCode) {
    var _a;
    const query = productCode ? { userId, productCode, payStatus: 'pending' } : { userId, payStatus: 'pending' };
    const result = await collection('orders').where(query).get();
    const orders = result.data;
    return (_a = orders.sort((left, right) => right.createdAt - left.createdAt)[0]) !== null && _a !== void 0 ? _a : null;
}
async function listOrdersByUserId(userId) {
    const result = await collection('orders').where({ userId }).get();
    return result.data.sort((left, right) => right.createdAt - left.createdAt);
}
async function listPendingOrdersByUserId(userId) {
    const result = await collection('orders').where({ userId, payStatus: 'pending' }).get();
    return result.data;
}
async function listInviteRelationsByInviterId(inviterUserId) {
    const result = await collection('inviteRelations').where({ inviterUserId }).get();
    return result.data.sort((left, right) => right.createdAt - left.createdAt);
}
async function getLatestEmailVerificationCode(emailOrUserId, now = Date.now(), currentEmail) {
    var _a;
    const codes = await listEmailVerificationCodes(emailOrUserId, currentEmail);
    return (_a = codes
        .filter((item) => item.expiresAt > now && !item.usedAt)
        .sort(sortEmailVerificationCodes)[0]) !== null && _a !== void 0 ? _a : null;
}
async function getLatestUnusedEmailVerificationCode(emailOrUserId, currentEmail) {
    var _a;
    const codes = await listEmailVerificationCodes(emailOrUserId, currentEmail);
    return (_a = codes
        .filter((item) => !item.usedAt)
        .sort(sortEmailVerificationCodes)[0]) !== null && _a !== void 0 ? _a : null;
}
async function getLatestAppStoreEmailVerificationCode(email, now = Date.now()) {
    var _a;
    const codes = await listAppStoreEmailVerificationCodes(email);
    return (_a = codes
        .filter((item) => item.expiresAt > now && !item.usedAt)
        .sort(sortAppStoreEmailVerificationCodes)[0]) !== null && _a !== void 0 ? _a : null;
}
async function getLatestUnusedAppStoreEmailVerificationCode(email) {
    var _a;
    const codes = await listAppStoreEmailVerificationCodes(email);
    return (_a = codes
        .filter((item) => !item.usedAt)
        .sort(sortAppStoreEmailVerificationCodes)[0]) !== null && _a !== void 0 ? _a : null;
}
async function listEmailVerificationCodes(emailOrUserId, currentEmail) {
    const normalizedInput = emailOrUserId.trim().toLowerCase();
    const normalizedEmail = (currentEmail !== null && currentEmail !== void 0 ? currentEmail : (normalizedInput.includes('@') ? normalizedInput : '')).trim().toLowerCase();
    if (normalizedInput.includes('@')) {
        const result = await collection('emailVerificationCodes').where({ email: normalizedInput }).get();
        return result.data;
    }
    const result = await collection('emailVerificationCodes').where({ userId: emailOrUserId }).get();
    const userCodes = result.data;
    if (normalizedEmail) {
        const matchedCodes = userCodes.filter((item) => item.email === normalizedEmail);
        if (matchedCodes.length > 0) {
            return matchedCodes;
        }
        const fallbackResult = await collection('emailVerificationCodes').where({ email: normalizedEmail }).get();
        return fallbackResult.data;
    }
    return userCodes;
}
async function listAppStoreEmailVerificationCodes(email) {
    const normalizedEmail = email.trim().toLowerCase();
    try {
        const result = await collection('appstoreEmailVerificationCodes').where({ email: normalizedEmail }).get();
        return result.data;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Table not exist')) {
            return [];
        }
        throw error;
    }
}
function sortEmailVerificationCodes(left, right) {
    const leftReceivedAt = left.receivedAt || left.createdAt || 0;
    const rightReceivedAt = right.receivedAt || right.createdAt || 0;
    if (rightReceivedAt !== leftReceivedAt) {
        return rightReceivedAt - leftReceivedAt;
    }
    return (right.createdAt || 0) - (left.createdAt || 0);
}
function sortAppStoreEmailVerificationCodes(left, right) {
    const leftReceivedAt = left.receivedAt || left.createdAt || 0;
    const rightReceivedAt = right.receivedAt || right.createdAt || 0;
    if (rightReceivedAt !== leftReceivedAt) {
        return rightReceivedAt - leftReceivedAt;
    }
    return (right.createdAt || 0) - (left.createdAt || 0);
}
