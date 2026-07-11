"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_TOOL_DEFINITIONS = exports.MAX_IMAGE_DATA_URL_LENGTH = exports.MAX_FILE_TEXT_LENGTH = exports.MAX_TEXT_LENGTH = exports.CHINA_TIMEZONE_OFFSET_MS = exports.AI_TOOL_DAILY_FREE_LIMIT = void 0;
exports.getAiToolDefinition = getAiToolDefinition;
exports.getAiToolUsageDateKey = getAiToolUsageDateKey;
exports.stripLegacyPromptPrefixes = stripLegacyPromptPrefixes;
exports.sanitizeText = sanitizeText;
exports.sanitizeFileText = sanitizeFileText;
exports.sanitizeFileName = sanitizeFileName;
exports.sanitizeFileType = sanitizeFileType;
exports.sanitizeImageDataUrl = sanitizeImageDataUrl;
exports.normalizeRunAiToolInput = normalizeRunAiToolInput;
exports.resolveAiToolEntitlement = resolveAiToolEntitlement;
exports.AI_TOOL_DAILY_FREE_LIMIT = 1;
exports.CHINA_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
exports.MAX_TEXT_LENGTH = 6000;
exports.MAX_FILE_TEXT_LENGTH = 6000;
exports.MAX_IMAGE_DATA_URL_LENGTH = 2.5 * 1024 * 1024;
exports.AI_TOOL_DEFINITIONS = [
    {
        toolId: 'articleSummary',
        name: '摘要总结',
        description: '长文、帖子、会议记录提炼结论和要点。',
        category: 'text',
        enabled: true,
        inputModes: ['text', 'file', 'image'],
        outputModes: ['summary', 'bullets', 'xiaohongshu', 'moments'],
        dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
    },
    {
        toolId: 'copywriting',
        name: '文案生成',
        description: '把素材改写成小红书或朋友圈文案。',
        category: 'text',
        enabled: true,
        inputModes: ['text', 'file', 'image'],
        outputModes: ['xiaohongshu', 'moments'],
        dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
    },
    {
        toolId: 'imageGenerate',
        name: 'AI 生图',
        description: '头像、海报、配图生成。',
        category: 'image',
        enabled: false,
        inputModes: ['text'],
        outputModes: ['image'],
        dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
    },
    {
        toolId: 'imageRepair',
        name: '老照片修复',
        description: '老照片褪色、划痕、模糊修复。',
        category: 'image',
        enabled: true,
        inputModes: ['image', 'text'],
        outputModes: ['image'],
        dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
    },
];
const LEGACY_PROMPT_PREFIXES = [
    '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：',
    '请把下面内容整理成行动清单，按优先级输出，避免空泛建议：',
    '请把下面内容改写成克制可信的小红书风格文案，包含标题、正文和标签：',
    '请把下面内容改写成适合朋友圈发布的短文案，语气自然、有信息密度：',
];
function getAiToolDefinition(toolId) {
    return exports.AI_TOOL_DEFINITIONS.find((item) => item.toolId === toolId);
}
function getAiToolUsageDateKey(timestamp = Date.now()) {
    const chinaDate = new Date(timestamp + exports.CHINA_TIMEZONE_OFFSET_MS);
    return chinaDate.toISOString().slice(0, 10);
}
function stripLegacyPromptPrefixes(value) {
    return LEGACY_PROMPT_PREFIXES.reduce((next, prefix) => next.split(prefix).join(''), value).trim();
}
function sanitizeText(value) {
    return stripLegacyPromptPrefixes(String(value || '')).slice(0, exports.MAX_TEXT_LENGTH);
}
function sanitizeFileText(value) {
    return String(value || '').trim().slice(0, exports.MAX_FILE_TEXT_LENGTH);
}
function sanitizeFileName(value) {
    return String(value || '').trim().replace(/[^\w.\-\u4e00-\u9fa5]/g, '').slice(0, 80);
}
function sanitizeFileType(value) {
    return String(value || '').trim().slice(0, 80);
}
function sanitizeImageDataUrl(value) {
    const imageDataUrl = String(value || '').trim();
    if (!imageDataUrl) {
        return '';
    }
    if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
        return '';
    }
    return imageDataUrl.length <= exports.MAX_IMAGE_DATA_URL_LENGTH ? imageDataUrl : '';
}
function normalizeToolId(value) {
    if (value === 'copywriting'
        || value === 'imageGenerate'
        || value === 'imageRepair'
        || value === 'articleSummary') {
        return value;
    }
    return 'articleSummary';
}
function normalizeOutputType(toolId, value) {
    if (toolId === 'copywriting') {
        return value === 'moments' ? 'moments' : 'xiaohongshu';
    }
    if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
        return value;
    }
    return 'summary';
}
function normalizeAssetIds(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 10);
}
function normalizeSource(value) {
    return value === 'wechat_ai_skill' ? 'wechat_ai_skill' : 'miniapp';
}
function normalizeRunAiToolInput(event = {}) {
    var _a;
    const toolId = normalizeToolId(event.toolId);
    const definition = getAiToolDefinition(toolId);
    if (!definition) {
        return {
            ok: false,
            code: 'TOOL_DISABLED',
            message: '该工具暂未开放',
        };
    }
    const text = sanitizeText((_a = event.text) !== null && _a !== void 0 ? _a : event.content);
    const fileText = sanitizeFileText(event.fileText);
    const imageDataUrl = sanitizeImageDataUrl(event.imageDataUrl);
    const assetIds = normalizeAssetIds(event.assetIds);
    if (!text && !fileText && !imageDataUrl && assetIds.length === 0) {
        return {
            ok: false,
            code: 'INVALID_INPUT',
            message: '请输入内容或添加素材',
        };
    }
    return {
        ok: true,
        input: {
            toolId,
            outputType: normalizeOutputType(toolId, event.outputType),
            text,
            fileText,
            fileName: sanitizeFileName(event.fileName),
            fileType: sanitizeFileType(event.fileType),
            imageDataUrl,
            assetIds,
            source: normalizeSource(event.source),
            rewardAdUnlocked: Boolean(event.rewardAdUnlocked || event.adUnlocked),
        },
    };
}
function resolveAiToolEntitlement(params) {
    if (params.isMember) {
        return {
            allowed: true,
            reason: 'member',
            usage: {
                charged: false,
                freeUsed: false,
                rewardAdUsed: false,
                memberUsed: true,
                dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
                dailyFreeRemaining: 0,
            },
        };
    }
    if (params.freeUsedToday < exports.AI_TOOL_DAILY_FREE_LIMIT) {
        return {
            allowed: true,
            reason: 'free',
            usage: {
                charged: false,
                freeUsed: true,
                rewardAdUsed: false,
                memberUsed: false,
                dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
                dailyFreeRemaining: Math.max(0, exports.AI_TOOL_DAILY_FREE_LIMIT - params.freeUsedToday - 1),
            },
        };
    }
    if (params.rewardAdUnlocked) {
        return {
            allowed: true,
            reason: 'reward_ad',
            usage: {
                charged: false,
                freeUsed: false,
                rewardAdUsed: true,
                memberUsed: false,
                dailyFreeLimit: exports.AI_TOOL_DAILY_FREE_LIMIT,
                dailyFreeRemaining: 0,
            },
        };
    }
    return {
        allowed: false,
        code: 'QUOTA_EXCEEDED',
        message: '今日免费次数已用完',
    };
}
