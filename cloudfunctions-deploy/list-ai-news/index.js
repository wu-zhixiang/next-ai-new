"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const ai_news_sort_1 = require("./shared/ai-news-sort");
function toView(record) {
    var _a;
    return {
        id: record._id,
        title: record.title,
        summary: record.summary,
        coverFileId: record.coverFileId,
        mediaType: record.mediaType,
        videoFileId: record.videoFileId,
        videoPosterFileId: record.videoPosterFileId,
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
    if (normalized === normalizeCategory('教程')) {
        return [
            '教程',
            '使用教程',
            '实战教程',
            '入门指南',
            '案例拆解',
            '开发实践',
            '指南',
            '教学',
            'HowTo',
            'Tutorial',
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
    const offset = Math.max(0, Number(event.offset) || 0);
    const tag = (_a = event.tag) === null || _a === void 0 ? void 0 : _a.trim();
    const sort = (0, ai_news_sort_1.normalizeAiNewsSort)(event.sort);
    const sortField = (0, ai_news_sort_1.getAiNewsPrimarySortField)(sort);
    const pageSize = limit + 1;
    let records = [];
    try {
        if (!tag) {
            const result = await (0, db_1.collection)('aiNews')
                .where({ status: 'published' })
                .orderBy(sortField, 'desc')
                .skip(offset)
                .limit(pageSize)
                .get();
            records = result.data;
        }
        else {
            const matched = [];
            let scanned = 0;
            const batchSize = 100;
            const target = offset + pageSize;
            while (matched.length < target) {
                const result = await (0, db_1.collection)('aiNews')
                    .where({ status: 'published' })
                    .orderBy(sortField, 'desc')
                    .skip(scanned)
                    .limit(batchSize)
                    .get();
                const batch = result.data;
                if (batch.length === 0) {
                    break;
                }
                matched.push(...batch.filter((item) => matchesCategory(item, tag)));
                scanned += batch.length;
                if (batch.length < batchSize) {
                    break;
                }
            }
            records = matched
                .sort((left, right) => (0, ai_news_sort_1.compareAiNewsRecords)(sort, left, right))
                .slice(offset, offset + pageSize);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Table not exist')) {
            return (0, utils_1.ok)({ items: [] });
        }
        throw error;
    }
    const items = records
        .slice(0, limit)
        .map(toView);
    return (0, utils_1.ok)({
        items,
        hasMore: records.length > limit,
        total: offset + items.length + (records.length > limit ? 1 : 0),
    });
}
