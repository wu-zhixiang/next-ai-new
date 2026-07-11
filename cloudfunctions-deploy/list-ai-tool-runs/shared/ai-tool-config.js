"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_IMAGE_REPAIR_WORKER_MODEL = exports.AI_IMAGE_WORKER_MODEL_OPTIONS = exports.DEFAULT_TOOL_TRIAL_LIMITS = exports.DEFAULT_TOOL_POINT_COSTS = exports.DEFAULT_TOOL_BASELINE_AT = exports.ADMIN_VISIBLE_DEFAULT_TOOL_IDS = void 0;
exports.sanitizeAiToolConfigText = sanitizeAiToolConfigText;
exports.getDefaultAdminToolDefinitions = getDefaultAdminToolDefinitions;
exports.getDefaultToolCardConfig = getDefaultToolCardConfig;
exports.getDefaultToolIntroConfig = getDefaultToolIntroConfig;
exports.normalizeToolConfigCategory = normalizeToolConfigCategory;
exports.normalizeToolConfigStatus = normalizeToolConfigStatus;
exports.normalizeDefinitionCategory = normalizeDefinitionCategory;
exports.getDefaultToolStatus = getDefaultToolStatus;
exports.normalizeAiToolWorkerModel = normalizeAiToolWorkerModel;
exports.normalizeAiToolTags = normalizeAiToolTags;
exports.normalizeAiToolSortOrder = normalizeAiToolSortOrder;
exports.normalizeAiToolIntroConfig = normalizeAiToolIntroConfig;
exports.hasAiToolIntroContent = hasAiToolIntroContent;
exports.buildDefaultAiToolRecord = buildDefaultAiToolRecord;
exports.toPublicAiToolView = toPublicAiToolView;
const ai_tool_core_1 = require("./ai-tool-core");
exports.ADMIN_VISIBLE_DEFAULT_TOOL_IDS = ['articleSummary', 'imageGenerate', 'imageRepair'];
exports.DEFAULT_TOOL_BASELINE_AT = Date.parse('2026-05-12T00:00:00.000Z');
exports.DEFAULT_TOOL_POINT_COSTS = {
    articleSummary: 5,
    copywriting: 5,
    imageGenerate: 20,
    imageRepair: 25,
};
exports.DEFAULT_TOOL_TRIAL_LIMITS = {
    articleSummary: 1,
    copywriting: 1,
    imageGenerate: 0,
    imageRepair: 1,
};
exports.AI_IMAGE_WORKER_MODEL_OPTIONS = [
    { value: 'google:image-lite', label: 'Gemini 低成本图片模型' },
    { value: 'google:image-flash', label: 'Gemini 主力图片模型' },
    { value: 'google:image-pro', label: 'Gemini 高质量图片模型' },
    { value: 'openai:gpt-image-1.5', label: 'Azure OpenAI 图片模型' },
];
exports.DEFAULT_IMAGE_REPAIR_WORKER_MODEL = 'google:image-flash';
const DEFAULT_TOOL_CARDS = {
    articleSummary: {
        title: '摘要总结',
        description: '长文、帖子、会议记录提炼结论',
        badge: '已上线',
        tags: ['已上线', '免费试用', '内容提效'],
        icon: '总',
        visible: true,
        sortOrder: 10,
        outputType: 'summary',
    },
    copywriting: {
        title: '文案生成',
        description: '小红书、朋友圈文案改写',
        badge: '已上线',
        tags: ['已上线', '文案改写', '社媒发布'],
        icon: '写',
        visible: false,
        sortOrder: 40,
        outputType: 'xiaohongshu',
    },
    imageGenerate: {
        title: 'AI生图',
        description: '头像、海报、配图生成',
        badge: '接入中',
        tags: ['接入中', '头像海报', '图片生成'],
        icon: '图',
        visible: true,
        sortOrder: 20,
        outputType: 'summary',
    },
    imageRepair: {
        title: '老照片修复',
        description: '老照片褪色、划痕、模糊修复',
        badge: '已上线',
        tags: ['已上线', '老照片', '清晰增强'],
        icon: '修',
        visible: true,
        sortOrder: 30,
        outputType: 'summary',
    },
};
const DEFAULT_TOOL_INTROS = {
    imageGenerate: {
        eyebrow: 'AI生图',
        title: '把一句想法变成可用图片',
        subtitle: '适合快速生成头像、社交配图、活动海报和内容封面。先选清楚用途，再进入工具页提交提示词。',
        highlights: [
            { title: '用途导向', desc: '围绕头像、封面、海报、商品图等实际场景组织提示词。' },
            { title: '参考素材', desc: '后续可结合参考图做风格延展、布局复刻和局部修改。' },
            { title: '模型分层', desc: '标准模型走低成本生成，高级模型按次数或点数控制成本。' },
        ],
        cases: [
            { mode: 'compare', title: '小红书封面', before: '只有文章标题和主题关键词', after: '生成统一风格封面，便于直接发布' },
            { mode: 'compare', title: '活动海报', before: '一句活动卖点和时间地点', after: '输出带明确视觉主体的海报草图' },
            { mode: 'compare', title: '头像方案', before: '描述人物气质和职业场景', after: '生成多种头像风格方向' },
        ],
        tips: ['主体、场景、风格、尺寸越明确，出图越稳定。', '涉及品牌、人物或版权素材时，请确保你有使用授权。'],
    },
    imageRepair: {
        eyebrow: '老照片修复',
        title: '让旧照片重新清晰',
        subtitle: '面向泛黄、褪色、划痕、折痕和低清扫描件，优先恢复照片可读性和人物细节。',
        highlights: [
            { title: '修复瑕疵', desc: '处理划痕、折痕、污点和扫描噪点，让画面更干净。' },
            { title: '增强清晰度', desc: '改善低清、轻微模糊和压缩损失，保留原照片质感。' },
            { title: '自然还原', desc: '避免过度美化，把重点放在真实照片的色彩和细节恢复。' },
        ],
        cases: [
            { mode: 'compare', title: '泛黄老照片', before: '照片整体发黄、对比度低', after: '肤色和背景更自然，人物轮廓更清楚' },
            { mode: 'compare', title: '折痕划痕', before: '画面有明显折线、白痕或污点', after: '瑕疵区域被修补，画面连续性更好' },
            { mode: 'compare', title: '低清扫描件', before: '老照片翻拍后偏糊、细节弱', after: '面部和服饰细节更容易辨认' },
        ],
        tips: ['请上传你本人拥有或已获授权处理的照片。', '严重缺失的人脸或背景无法保证完全还原，只能做合理修复。'],
    },
};
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function sanitizeAiToolConfigText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function cloneIntroConfig(intro) {
    return {
        eyebrow: intro.eyebrow,
        title: intro.title,
        subtitle: intro.subtitle,
        highlights: intro.highlights.map((item) => ({ ...item })),
        cases: intro.cases.map((item) => ({ ...item })),
        tips: intro.tips ? [...intro.tips] : undefined,
    };
}
function getDefaultAdminToolDefinitions() {
    return exports.ADMIN_VISIBLE_DEFAULT_TOOL_IDS
        .map((toolId) => ai_tool_core_1.AI_TOOL_DEFINITIONS.find((definition) => definition.toolId === toolId))
        .filter((definition) => Boolean(definition));
}
function getDefaultToolCardConfig(toolId) {
    return { ...DEFAULT_TOOL_CARDS[toolId] };
}
function getDefaultToolIntroConfig(toolId) {
    const intro = DEFAULT_TOOL_INTROS[toolId];
    return intro ? cloneIntroConfig(intro) : undefined;
}
function normalizeToolConfigCategory(value) {
    return value === 'image' || value === 'video' || value === 'workflow' ? value : 'text';
}
function normalizeToolConfigStatus(value) {
    return value === 'enabled' || value === 'disabled' ? value : 'testing';
}
function normalizeDefinitionCategory(category) {
    return category === 'image' ? 'image' : 'text';
}
function getDefaultToolStatus(definition) {
    return definition.enabled ? 'enabled' : 'testing';
}
function normalizeToolOutputType(value, fallback) {
    return value === 'bullets' || value === 'xiaohongshu' || value === 'moments' ? value : fallback;
}
function normalizeImageFileId(value) {
    return sanitizeAiToolConfigText(value, 500);
}
function normalizeAiToolWorkerModel(value, fallback = '') {
    const model = sanitizeAiToolConfigText(value, 80);
    if (exports.AI_IMAGE_WORKER_MODEL_OPTIONS.some((item) => item.value === model)) {
        return model;
    }
    return fallback;
}
function normalizeAiToolTags(value, fallback = []) {
    const source = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/[,\n，、]+/)
            : fallback;
    const tags = [];
    for (const item of source) {
        const tag = sanitizeAiToolConfigText(item, 16);
        if (tag && !tags.includes(tag)) {
            tags.push(tag);
        }
        if (tags.length >= 8) {
            break;
        }
    }
    return tags;
}
function normalizeAiToolSortOrder(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}
function normalizeHighlight(value) {
    if (!isRecord(value)) {
        return null;
    }
    const title = sanitizeAiToolConfigText(value.title, 30);
    const desc = sanitizeAiToolConfigText(value.desc, 120);
    return title || desc ? { title, desc } : null;
}
function normalizeCase(value) {
    if (!isRecord(value)) {
        return null;
    }
    const title = sanitizeAiToolConfigText(value.title, 40);
    if (value.mode === 'preview') {
        const previewImageFileId = normalizeImageFileId(value.previewImageFileId);
        const previewDescription = sanitizeAiToolConfigText(value.previewDescription, 120);
        return title || previewImageFileId || previewDescription
            ? { mode: 'preview', title, previewImageFileId, previewDescription }
            : null;
    }
    const before = sanitizeAiToolConfigText(value.before, 120);
    const after = sanitizeAiToolConfigText(value.after, 120);
    const beforeImageFileId = normalizeImageFileId(value.beforeImageFileId);
    const afterImageFileId = normalizeImageFileId(value.afterImageFileId);
    return title || before || after || beforeImageFileId || afterImageFileId
        ? { mode: 'compare', title, before, after, beforeImageFileId, afterImageFileId }
        : null;
}
function normalizeAiToolIntroConfig(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const eyebrow = sanitizeAiToolConfigText(value.eyebrow, 30);
    const title = sanitizeAiToolConfigText(value.title, 60);
    const subtitle = sanitizeAiToolConfigText(value.subtitle, 180);
    const highlights = Array.isArray(value.highlights)
        ? value.highlights.map(normalizeHighlight).filter((item) => Boolean(item)).slice(0, 6)
        : [];
    const cases = Array.isArray(value.cases)
        ? value.cases.map(normalizeCase).filter((item) => Boolean(item)).slice(0, 12)
        : [];
    const tips = Array.isArray(value.tips)
        ? value.tips.map((item) => sanitizeAiToolConfigText(item, 120)).filter(Boolean).slice(0, 6)
        : [];
    if (!eyebrow && !title && !subtitle && highlights.length === 0 && cases.length === 0 && tips.length === 0) {
        return undefined;
    }
    return {
        eyebrow,
        title,
        subtitle,
        highlights,
        cases,
        ...(tips.length ? { tips } : {}),
    };
}
function hasAiToolIntroContent(intro) {
    return Boolean((intro === null || intro === void 0 ? void 0 : intro.title) && intro.cases.length > 0);
}
function buildDefaultAiToolRecord(definition) {
    const card = getDefaultToolCardConfig(definition.toolId);
    return {
        _id: definition.toolId,
        toolId: definition.toolId,
        name: definition.name,
        category: normalizeDefinitionCategory(definition.category),
        status: getDefaultToolStatus(definition),
        runCount: 0,
        pointCost: exports.DEFAULT_TOOL_POINT_COSTS[definition.toolId],
        trialLimit: exports.DEFAULT_TOOL_TRIAL_LIMITS[definition.toolId],
        createdAt: exports.DEFAULT_TOOL_BASELINE_AT,
        updatedAt: exports.DEFAULT_TOOL_BASELINE_AT,
        builtIn: true,
        cardTitle: card.title,
        cardDescription: card.description,
        cardBadge: card.badge,
        tags: card.tags,
        icon: card.icon,
        iconImageFileId: card.iconImageFileId,
        visible: card.visible,
        sortOrder: card.sortOrder,
        outputType: card.outputType,
        workerModel: definition.toolId === 'imageRepair' ? exports.DEFAULT_IMAGE_REPAIR_WORKER_MODEL : undefined,
        intro: getDefaultToolIntroConfig(definition.toolId),
    };
}
function toPublicAiToolView(record) {
    var _a, _b, _c, _d, _e, _f, _g;
    const toolId = (_a = record.toolId) !== null && _a !== void 0 ? _a : record._id;
    const defaultCard = ai_tool_core_1.AI_TOOL_DEFINITIONS.find((definition) => definition.toolId === toolId)
        ? getDefaultToolCardConfig(toolId)
        : undefined;
    const outputType = normalizeToolOutputType(record.outputType, (_b = defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.outputType) !== null && _b !== void 0 ? _b : 'summary');
    const intro = normalizeAiToolIntroConfig(record.intro);
    const tags = normalizeAiToolTags(record.tags, [record.cardBadge || (defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.badge) || ''].filter(Boolean));
    const status = normalizeToolConfigStatus(record.status);
    return {
        id: toolId,
        toolId,
        name: record.cardTitle || record.name,
        desc: record.cardDescription || (defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.description) || '',
        badge: tags[0] || record.cardBadge || (defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.badge) || (record.status === 'enabled' ? '已上线' : '接入中'),
        tags,
        icon: record.icon || (defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.icon) || 'AI',
        iconImageFileId: record.iconImageFileId || (defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.iconImageFileId),
        status,
        enabled: status === 'enabled',
        visible: record.visible !== false && !record.deleted,
        sortOrder: normalizeAiToolSortOrder(record.sortOrder, (_c = defaultCard === null || defaultCard === void 0 ? void 0 : defaultCard.sortOrder) !== null && _c !== void 0 ? _c : 999),
        outputType,
        workerModel: normalizeAiToolWorkerModel(record.workerModel),
        pointCost: Math.max(0, Math.floor(Number((_e = (_d = record.pointCost) !== null && _d !== void 0 ? _d : exports.DEFAULT_TOOL_POINT_COSTS[toolId]) !== null && _e !== void 0 ? _e : 0))),
        trialLimit: Math.max(0, Math.floor(Number((_g = (_f = record.trialLimit) !== null && _f !== void 0 ? _f : exports.DEFAULT_TOOL_TRIAL_LIMITS[toolId]) !== null && _g !== void 0 ? _g : 0))),
        ...(hasAiToolIntroContent(intro) ? { intro } : {}),
    };
}
