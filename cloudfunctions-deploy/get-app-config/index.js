"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const cloud = require("wx-server-sdk");
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV,
});
const db = cloud.database();
const DEFAULT_CONFIG = {
    enableNewsAuthModal: true,
};
function ok(data, message = 'ok') {
    return {
        code: 0,
        message,
        data,
    };
}
async function main() {
    var _a;
    try {
        const result = await db.collection('app_config').doc('client').get();
        const config = (_a = result.data) !== null && _a !== void 0 ? _a : {};
        return ok({
            enableNewsAuthModal: config.enableNewsAuthModal !== false,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('collection not exists')
            || message.includes('DATABASE_COLLECTION_NOT_EXIST')
            || message.includes('Table not exist')
            || message.includes('document.get:fail')
            || message.includes('cannot find document')) {
            return ok(DEFAULT_CONFIG);
        }
        throw error;
    }
}
