"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INVITE_BASE_REWARD_POINTS = exports.DEFAULT_POINTS_PER_YUAN = exports.POINTS_CONFIG_ID = void 0;
exports.normalizeInviteMilestones = normalizeInviteMilestones;
exports.normalizePointsConfigRecord = normalizePointsConfigRecord;
exports.getMilestoneKey = getMilestoneKey;
exports.calculatePointsDeduction = calculatePointsDeduction;
exports.POINTS_CONFIG_ID = 'default';
exports.DEFAULT_POINTS_PER_YUAN = 1;
exports.DEFAULT_INVITE_BASE_REWARD_POINTS = 5;
function normalizePositiveInteger(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : fallback;
}
function normalizeNonNegativeInteger(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}
function normalizeMilestoneId(value, inviteCount) {
    const raw = typeof value === 'string' ? value.trim() : '';
    const normalized = raw
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return normalized || `invite_${inviteCount}`;
}
function normalizeInviteMilestones(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const milestones = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            continue;
        }
        const record = item;
        const inviteCount = normalizePositiveInteger(record.inviteCount, 1);
        const rewardPoints = normalizeNonNegativeInteger(record.rewardPoints);
        if (rewardPoints <= 0) {
            continue;
        }
        milestones.push({
            id: normalizeMilestoneId(record.id, inviteCount),
            inviteCount,
            rewardPoints,
            enabled: record.enabled !== false,
            description: typeof record.description === 'string' ? record.description.trim().slice(0, 80) : '',
        });
    }
    const sortedMilestones = milestones
        .sort((left, right) => left.inviteCount - right.inviteCount)
        .slice(0, 20);
    const seen = new Set();
    return sortedMilestones.filter((item) => {
        const key = item.id || `invite_${item.inviteCount}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function normalizePointsConfigRecord(value) {
    const now = Date.now();
    return {
        configId: exports.POINTS_CONFIG_ID,
        pointsPerYuan: normalizePositiveInteger(value === null || value === void 0 ? void 0 : value.pointsPerYuan, exports.DEFAULT_POINTS_PER_YUAN),
        inviteBaseRewardPoints: normalizeNonNegativeInteger(value === null || value === void 0 ? void 0 : value.inviteBaseRewardPoints, exports.DEFAULT_INVITE_BASE_REWARD_POINTS),
        inviteMilestones: normalizeInviteMilestones(value === null || value === void 0 ? void 0 : value.inviteMilestones),
        createdAt: normalizeNonNegativeInteger(value === null || value === void 0 ? void 0 : value.createdAt, now),
        updatedAt: normalizeNonNegativeInteger(value === null || value === void 0 ? void 0 : value.updatedAt, now),
    };
}
function getMilestoneKey(milestone) {
    return milestone.id || `invite_${milestone.inviteCount}`;
}
function calculatePointsDeduction(params) {
    const price = Math.max(0, Number(params.price) || 0);
    const pointsPerYuan = normalizePositiveInteger(params.pointsPerYuan, exports.DEFAULT_POINTS_PER_YUAN);
    const availablePoints = Math.max(0, Math.floor(params.availablePoints || 0));
    const maxDeductiblePoints = Math.floor(price * pointsPerYuan);
    const pointsDeducted = params.usePointsDeduction ? Math.min(availablePoints, maxDeductiblePoints) : 0;
    const rawDeductAmount = pointsDeducted / pointsPerYuan;
    const pointsDeductAmount = Number(Math.min(price, rawDeductAmount).toFixed(2));
    return {
        pointsDeducted,
        pointsDeductAmount,
        payableAmount: Number(Math.max(0, price - pointsDeductAmount).toFixed(2)),
    };
}
