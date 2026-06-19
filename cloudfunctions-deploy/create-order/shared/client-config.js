"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientAppConfig = getClientAppConfig;
const wx_server_sdk_1 = __importDefault(require("wx-server-sdk"));
const payment_config_1 = require("./payment-config");
wx_server_sdk_1.default.init({
    env: wx_server_sdk_1.default.DYNAMIC_CURRENT_ENV,
});
const db = wx_server_sdk_1.default.database();
const DEFAULT_CLIENT_APP_CONFIG = {
    enableNewsAuthModal: true,
    enableProductComplianceMode: false,
    paymentType: 'virtual',
};
function isMissingConfigError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return (message.includes('collection not exists')
        || message.includes('DATABASE_COLLECTION_NOT_EXIST')
        || message.includes('Table not exist')
        || message.includes('document.get:fail')
        || message.includes('cannot find document'));
}
async function getClientAppConfig() {
    var _a;
    try {
        const result = await db.collection('app_config').doc('client').get();
        const config = ((_a = result.data) !== null && _a !== void 0 ? _a : {});
        return {
            enableNewsAuthModal: config.enableNewsAuthModal !== false,
            enableProductComplianceMode: config.enableProductComplianceMode === true,
            paymentType: (0, payment_config_1.normalizePaymentType)(config.paymentType),
        };
    }
    catch (error) {
        if (isMissingConfigError(error)) {
            return DEFAULT_CLIENT_APP_CONFIG;
        }
        throw error;
    }
}
