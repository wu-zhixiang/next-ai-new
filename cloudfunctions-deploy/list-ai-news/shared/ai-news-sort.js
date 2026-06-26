"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAiNewsSort = normalizeAiNewsSort;
exports.getAiNewsPrimarySortField = getAiNewsPrimarySortField;
exports.compareAiNewsRecords = compareAiNewsRecords;
function normalizeAiNewsSort(value) {
    return value === 'latest' ? 'latest' : 'hot';
}
function getAiNewsPrimarySortField(sort) {
    return sort === 'latest' ? 'publishedAt' : 'score';
}
function compareAiNewsRecords(sort, left, right) {
    const leftTime = left.publishedAt || left.createdAt || 0;
    const rightTime = right.publishedAt || right.createdAt || 0;
    if (sort === 'latest') {
        return rightTime - leftTime;
    }
    const scoreDiff = (right.score || 0) - (left.score || 0);
    return scoreDiff || rightTime - leftTime;
}
