"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_TYPE_SEED = void 0;
exports.seedProductTypes = seedProductTypes;
const constants_1 = require("./constants");
const db_1 = require("./db");
const CHATGPT_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/chatgpt_avatar_handdrawn_200x200.png?sign=a90045835786ba674c878e1fe4b1ad77&t=1781704918';
const CLAUDE_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/claude_avatar_200x200_no_white.png?sign=0cfe12826649cd2d1b410eb1a2d71487&t=1781705092';
exports.PRODUCT_TYPE_SEED = [
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: 'ChatGPT Plus',
        label: 'ChatGPT Plus',
        tag: '稳定性',
        avatarUrl: CHATGPT_AVATAR_URL,
        available: true,
        description: '适合 Codex、image-2重度依赖用户场景。',
        introHighlights: [
            { title: 'ChatGPT 权益', description: '适合 Codex、image-2重度依赖用户场景。' },
            { title: '会员服务', description: '开通后进入人工处理流程，完成后展示会员有效期。' },
            { title: '当前状态', description: '支持购买' },
        ],
        sort: 1,
        status: 'on',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
    {
        productCode: 'claude_pro',
        productName: 'Claude Pro 会员',
        label: 'Claude Pro',
        tag: '性价比',
        avatarUrl: CLAUDE_AVATAR_URL,
        available: true,
        description: '适合 Claude Code、微信公众号、小红书、电商运营等用户场景。',
        introHighlights: [
            { title: 'Claude 权益', description: '微信公众号、小红书、电商运营等用户' },
            { title: '独立套餐', description: '后续将接入专属套餐、订单和交付流程。' },
            { title: '当前状态', description: '支持选择' },
        ],
        sort: 2,
        status: 'on',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
];
async function seedProductTypes(now = Date.now()) {
    await (0, db_1.ensureCollection)('productTypes');
    for (const seed of exports.PRODUCT_TYPE_SEED) {
        const existing = await (0, db_1.collection)('productTypes').where({ productCode: seed.productCode }).limit(1).get();
        const current = existing.data[0];
        if (current === null || current === void 0 ? void 0 : current._id) {
            await (0, db_1.collection)('productTypes').doc(current._id).update({
                data: {
                    ...seed,
                    updatedAt: now,
                },
            });
            continue;
        }
        await (0, db_1.collection)('productTypes').add({
            data: {
                ...seed,
                createdAt: now,
                updatedAt: now,
            },
        });
    }
    return exports.PRODUCT_TYPE_SEED.length;
}
