"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMembershipOpenedReminder = sendMembershipOpenedReminder;
const db_1 = require("./db");
function getDateKey(timestamp) {
    const date = new Date(timestamp + 8 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
}
function formatTime(timestamp) {
    const date = new Date(timestamp + 8 * 60 * 60 * 1000);
    return date.toISOString().replace('T', ' ').slice(0, 16);
}
async function addReminderLog(record) {
    await (0, db_1.collection)('reminderLogs').add({ data: record });
}
async function sendTemplateMessage(user, templateId, data) {
    var _a;
    if (!templateId) {
        throw new Error('缺少开通成功模板：WX_MEMBER_OPENED_TEMPLATE_ID');
    }
    const openapi = db_1.app.openapi;
    if (!((_a = openapi === null || openapi === void 0 ? void 0 : openapi.subscribeMessage) === null || _a === void 0 ? void 0 : _a.send)) {
        throw new Error('当前云函数环境不支持 subscribeMessage.send');
    }
    await openapi.subscribeMessage.send({
        touser: user.openid,
        templateId,
        page: 'pages/member/index',
        data,
    });
}
async function sendMembershipOpenedReminder(order, options) {
    var _a;
    const createdAt = (_a = options.createdAt) !== null && _a !== void 0 ? _a : Date.now();
    const user = await (0, db_1.getUserById)(order.userId);
    const baseLog = {
        userId: order.userId,
        orderNo: order.orderNo,
        productCode: order.productCode,
        remindDate: getDateKey(createdAt),
        type: 'membership_opened',
        createdAt,
    };
    if (!(user === null || user === void 0 ? void 0 : user.openid) || !user.subscribeMsgAuth) {
        await addReminderLog({
            ...baseLog,
            status: 'skipped',
            message: !(user === null || user === void 0 ? void 0 : user.openid) ? '用户缺少 openid' : '用户未授权订阅消息',
        });
        return;
    }
    try {
        await sendTemplateMessage(user, process.env.WX_MEMBER_OPENED_TEMPLATE_ID || '', {
            thing1: { value: order.planName || order.productName || 'Open AI 资讯会员' },
            phrase2: { value: '月度' },
            time3: { value: formatTime(options.endAt) },
            thing4: { value: '会员已开通，可进入会员中心查看权益' },
        });
        await addReminderLog({
            ...baseLog,
            status: 'sent',
        });
    }
    catch (error) {
        await addReminderLog({
            ...baseLog,
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
        });
    }
}
