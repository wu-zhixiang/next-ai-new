"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePointsConfigRecord = exports.normalizeInviteMilestones = exports.getMilestoneKey = exports.calculatePointsDeduction = exports.POINTS_CONFIG_ID = exports.DEFAULT_POINTS_PER_YUAN = exports.DEFAULT_INVITE_BASE_REWARD_POINTS = void 0;
exports.getPointsConfig = getPointsConfig;
const db_1 = require("./db");
const points_config_core_1 = require("./points-config-core");
var points_config_core_2 = require("./points-config-core");
Object.defineProperty(exports, "DEFAULT_INVITE_BASE_REWARD_POINTS", { enumerable: true, get: function () { return points_config_core_2.DEFAULT_INVITE_BASE_REWARD_POINTS; } });
Object.defineProperty(exports, "DEFAULT_POINTS_PER_YUAN", { enumerable: true, get: function () { return points_config_core_2.DEFAULT_POINTS_PER_YUAN; } });
Object.defineProperty(exports, "POINTS_CONFIG_ID", { enumerable: true, get: function () { return points_config_core_2.POINTS_CONFIG_ID; } });
Object.defineProperty(exports, "calculatePointsDeduction", { enumerable: true, get: function () { return points_config_core_2.calculatePointsDeduction; } });
Object.defineProperty(exports, "getMilestoneKey", { enumerable: true, get: function () { return points_config_core_2.getMilestoneKey; } });
Object.defineProperty(exports, "normalizeInviteMilestones", { enumerable: true, get: function () { return points_config_core_2.normalizeInviteMilestones; } });
Object.defineProperty(exports, "normalizePointsConfigRecord", { enumerable: true, get: function () { return points_config_core_2.normalizePointsConfigRecord; } });
function isMissingConfigError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return (message.includes('collection not exists')
        || message.includes('DATABASE_COLLECTION_NOT_EXIST')
        || message.includes('Table not exist')
        || message.includes('document.get:fail')
        || message.includes('cannot find document'));
}
async function getPointsConfig() {
    var _a;
    try {
        const result = await (0, db_1.collection)('pointsConfig')
            .where({ configId: points_config_core_1.POINTS_CONFIG_ID })
            .limit(1)
            .get();
        return (0, points_config_core_1.normalizePointsConfigRecord)((_a = result.data[0]) !== null && _a !== void 0 ? _a : null);
    }
    catch (error) {
        if (isMissingConfigError(error)) {
            return (0, points_config_core_1.normalizePointsConfigRecord)(null);
        }
        throw error;
    }
}
