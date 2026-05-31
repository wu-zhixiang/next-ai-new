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
        contentMarkdown: record.contentMarkdown,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        authorName: record.authorName,
        sourcePlatform: record.sourcePlatform,
        tags: (_a = record.tags) !== null && _a !== void 0 ? _a : [],
        heat: Math.max(0, Math.round(record.score || record.viewCount || 0)),
        publishedAt: record.publishedAt,
    };
}
async function main(event = {}) {
    var _a;
    const id = (_a = event.id) === null || _a === void 0 ? void 0 : _a.trim();
    if (!id) {
        throw new Error('缺少资讯 ID');
    }
    const result = await (0, db_1.collection)('aiNews').doc(id).get();
    const record = result.data;
    if (!record || record.status !== 'published') {
        throw new Error('资讯不存在或未发布');
    }
    return (0, utils_1.ok)(toView(record));
}
