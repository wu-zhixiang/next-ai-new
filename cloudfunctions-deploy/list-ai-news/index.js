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
function getCategoryAliases(tag) {
    const normalized = normalizeCategory(tag);
    if (normalized === normalizeCategory('AI巨头')) {
        return [
            'AI巨头',
            'OpenAI',
            'Open AI',
            'Google AI',
            'Google',
            'DeepMind',
            'Google DeepMind',
            'Claude AI',
            'Claude',
            'Anthropic',
            'Meta AI',
            'Microsoft AI',
            'xAI',
            'Grok',
        ].map(normalizeCategory);
    }
    if (normalized === normalizeCategory('工具')) {
        return [
            '工具',
            'AI工具',
            '开发者工具',
            'Agent',
            '图片生成',
            '视频生成',
            '办公提效',
            '编程助手',
            '提示词',
            'GitHub',
            'Hugging Face',
        ].map(normalizeCategory);
    }
    return [normalized];
}
function matchesCategory(record, tag) {
    var _a;
    const targets = new Set(getCategoryAliases(tag));
    return ((_a = record.tags) !== null && _a !== void 0 ? _a : []).some((item) => targets.has(normalizeCategory(item)));
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
