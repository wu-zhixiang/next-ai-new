"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function getDateKey(timestamp) {
    const date = new Date(timestamp + 8 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
}
function formatTime(timestamp) {
    const date = new Date(timestamp + 8 * 60 * 60 * 1000);
    return date.toISOString().replace('T', ' ').slice(0, 16);
}
async function getUserById(userId) {
    var _a;
    const result = await (0, db_1.collection)('users').doc(userId).get();
    return (_a = result.data) !== null && _a !== void 0 ? _a : null;
}
async function hasReminderLog(userId, membershipId, remindDate) {
    const result = await (0, db_1.collection)('reminderLogs')
        .where({
        userId,
        membershipId,
        remindDate,
        type: 'renew_before_2d',
    })
        .limit(1)
        .get();
    return Boolean(result.data[0]);
}
async function addReminderLog(record) {
    await (0, db_1.collection)('reminderLogs').add({ data: record });
}
async function sendSubscribeMessage(user, membership) {
    var _a;
    const templateId = process.env.WX_RENEW_REMINDER_TEMPLATE_ID;
    if (!templateId) {
        throw new Error('缺少续费提醒模板：WX_RENEW_REMINDER_TEMPLATE_ID');
    }
    const openapi = db_1.app.openapi;
    if (!((_a = openapi === null || openapi === void 0 ? void 0 : openapi.subscribeMessage) === null || _a === void 0 ? void 0 : _a.send)) {
        throw new Error('当前云函数环境不支持 subscribeMessage.send');
    }
    await openapi.subscribeMessage.send({
        touser: user.openid,
        templateId,
        page: 'pages/member/index',
        data: {
            thing1: { value: membership.planName || membership.productName || 'Open AI 资讯会员' },
            phrase2: { value: '月度' },
            time3: { value: formatTime(membership.endAt) },
            thing4: { value: '会员即将到期，请及时续费' },
        },
    });
}
async function main(event = {}) {
    var _a;
    const now = (_a = event.now) !== null && _a !== void 0 ? _a : Date.now();
    const windowStart = now;
    const windowEnd = now + TWO_DAYS_MS;
    const remindDate = getDateKey(now);
    const result = await (0, db_1.collection)('memberships')
        .where({
        status: 'active',
    })
        .get();
    const memberships = result.data
        .filter((membership) => membership.endAt > windowStart && membership.endAt <= windowEnd);
    const summary = {
        candidates: memberships.length,
        sent: 0,
        skipped: 0,
        failed: 0,
    };
    for (const membership of memberships) {
        const user = await getUserById(membership.userId);
        const alreadySent = await hasReminderLog(membership.userId, membership._id, remindDate);
        if (!(user === null || user === void 0 ? void 0 : user.openid) || !user.subscribeMsgAuth || alreadySent || membership.endAt - now > TWO_DAYS_MS + ONE_DAY_MS) {
            summary.skipped += 1;
            if (!event.dryRun && !alreadySent) {
                await addReminderLog({
                    userId: membership.userId,
                    membershipId: membership._id,
                    productCode: membership.productCode,
                    remindDate,
                    type: 'renew_before_2d',
                    status: 'skipped',
                    message: !(user === null || user === void 0 ? void 0 : user.openid) ? '用户缺少 openid' : !user.subscribeMsgAuth ? '用户未授权订阅消息' : '不满足发送条件',
                    createdAt: now,
                });
            }
            continue;
        }
        if (event.dryRun) {
            summary.sent += 1;
            continue;
        }
        try {
            await sendSubscribeMessage(user, membership);
            summary.sent += 1;
            await addReminderLog({
                userId: membership.userId,
                membershipId: membership._id,
                productCode: membership.productCode,
                remindDate,
                type: 'renew_before_2d',
                status: 'sent',
                createdAt: now,
            });
        }
        catch (error) {
            summary.failed += 1;
            await addReminderLog({
                userId: membership.userId,
                membershipId: membership._id,
                productCode: membership.productCode,
                remindDate,
                type: 'renew_before_2d',
                status: 'failed',
                message: error instanceof Error ? error.message : String(error),
                createdAt: now,
            });
        }
    }
    return (0, utils_1.ok)(summary);
}
