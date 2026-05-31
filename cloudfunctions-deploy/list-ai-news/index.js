"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
function toView(record) {
    var _a;
    return {
        id: record._id,
        title: record.title,
        summary: record.summary,
        coverFileId: record.coverFileId,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        authorName: record.authorName,
        sourcePlatform: record.sourcePlatform,
        tags: (_a = record.tags) !== null && _a !== void 0 ? _a : [],
        heat: Math.max(0, Math.round(record.score || record.viewCount || 0)),
        publishedAt: record.publishedAt,
    };
}
function normalizeCategory(value) {
    return value.toLowerCase().replace(/[\s_-]+/g, '');
}
function matchesCategory(record, tag) {
    var _a;
    const target = normalizeCategory(tag);
    return ((_a = record.tags) !== null && _a !== void 0 ? _a : []).some((item) => normalizeCategory(item) === target);
}
async function main(event = {}) {
    var _a;
    const limit = Math.max(1, Math.min(Number(event.limit) || 20, 50));
    let result;
    try {
        result = await (0, db_1.collection)('aiNews')
            .where({
            status: 'published',
        })
            .get();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Table not exist')) {
            return (0, utils_1.ok)({ items: [] });
        }
        throw error;
    }
    const tag = (_a = event.tag) === null || _a === void 0 ? void 0 : _a.trim();
    const sort = event.sort === 'latest' ? 'latest' : 'hot';
    const items = result.data
        .filter((item) => !tag || matchesCategory(item, tag))
        .sort((left, right) => {
        if (sort === 'latest') {
            return (right.publishedAt || right.createdAt) - (left.publishedAt || left.createdAt);
        }
        const scoreDiff = (right.score || 0) - (left.score || 0);
        return scoreDiff || (right.publishedAt || right.createdAt) - (left.publishedAt || left.createdAt);
    })
        .slice(0, limit)
        .map(toView);
    return (0, utils_1.ok)({ items });
}
