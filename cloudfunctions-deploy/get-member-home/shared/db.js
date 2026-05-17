"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports._ = exports.db = exports.app = void 0;
exports.collection = collection;
exports.getUserByOpenId = getUserByOpenId;
exports.getUserById = getUserById;
exports.getMembershipByUserId = getMembershipByUserId;
exports.listMembershipsByUserId = listMembershipsByUserId;
exports.getDeliveryByUserId = getDeliveryByUserId;
exports.getPlanByCode = getPlanByCode;
exports.getOrderByNo = getOrderByNo;
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
