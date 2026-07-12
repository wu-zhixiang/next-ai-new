"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const context_1 = require("./_lib/context");
const db_1 = require("./shared/db");
const ai_tool_config_1 = require("./shared/ai-tool-config");
const utils_1 = require("./shared/utils");
function isMissingToolsCollectionError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return (message.includes('collection not exists')
        || message.includes('DATABASE_COLLECTION_NOT_EXIST')
        || message.includes('Table not exist'));
}
async function readToolRecords() {
    try {
        await (0, db_1.ensureCollection)('aiTools');
        const result = await (0, db_1.collection)('aiTools').get();
        return result.data;
    }
    catch (error) {
        if (isMissingToolsCollectionError(error)) {
            return [];
        }
        throw error;
    }
}
function findOverrideRecord(records, toolId) {
    return records.find((record) => record.toolId === toolId || record._id === toolId);
}
function mergeDefaultToolRecords(records) {
    return (0, ai_tool_config_1.getDefaultAdminToolDefinitions)()
        .map((definition) => {
        const base = (0, ai_tool_config_1.buildDefaultAiToolRecord)(definition);
        const override = findOverrideRecord(records, definition.toolId);
        if (override === null || override === void 0 ? void 0 : override.deleted) {
            return null;
        }
        return override
            ? {
                ...base,
                ...override,
                _id: override._id,
                toolId: definition.toolId,
                builtIn: true,
            }
            : base;
    })
        .filter((record) => Boolean(record));
}
async function readUserToolUsageByToolId() {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        return new Map();
    }
    try {
        await (0, db_1.ensureCollection)('aiToolUserUsage');
        const result = await (0, db_1.collection)('aiToolUserUsage').where({ userId: user._id }).get();
        return new Map(result.data
            .filter((record) => Boolean(record.toolId))
            .map((record) => [record.toolId, record]));
    }
    catch (error) {
        if (isMissingToolsCollectionError(error)) {
            return new Map();
        }
        throw error;
    }
}
async function main() {
    const [records, usageByToolId] = await Promise.all([
        readToolRecords(),
        readUserToolUsageByToolId(),
    ]);
    const data = mergeDefaultToolRecords(records)
        .map((record) => {
        var _a;
        const tool = (0, ai_tool_config_1.toPublicAiToolView)(record);
        const usage = usageByToolId.get(tool.toolId);
        return {
            ...tool,
            trialRemaining: Math.max(0, tool.trialLimit - Math.max(0, Math.floor(Number((_a = usage === null || usage === void 0 ? void 0 : usage.trialUsed) !== null && _a !== void 0 ? _a : 0)))),
        };
    })
        .filter((tool) => tool.visible)
        .sort((left, right) => (0, ai_tool_config_1.normalizeAiToolSortOrder)(left.sortOrder, 999) - (0, ai_tool_config_1.normalizeAiToolSortOrder)(right.sortOrder, 999));
    return (0, utils_1.ok)(data);
}
