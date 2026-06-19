"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const wx_server_sdk_1 = __importDefault(require("wx-server-sdk"));
const utils_1 = require("./shared/utils");
wx_server_sdk_1.default.init({
    env: wx_server_sdk_1.default.DYNAMIC_CURRENT_ENV,
});
const db = wx_server_sdk_1.default.database();
const DEFAULT_CONFIG = {
    enableNewsAuthModal: true,
    enableProductComplianceMode: false,
};
async function main() {
    var _a;
    try {
        const result = await db.collection('app_config').doc('client').get();
        const config = ((_a = result.data) !== null && _a !== void 0 ? _a : {});
        return (0, utils_1.ok)({
            enableNewsAuthModal: config.enableNewsAuthModal !== false,
            enableProductComplianceMode: config.enableProductComplianceMode === true,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('collection not exists')
            || message.includes('DATABASE_COLLECTION_NOT_EXIST')
            || message.includes('Table not exist')
            || message.includes('document.get:fail')
            || message.includes('cannot find document')) {
            return (0, utils_1.ok)(DEFAULT_CONFIG);
        }
        throw error;
    }
}
