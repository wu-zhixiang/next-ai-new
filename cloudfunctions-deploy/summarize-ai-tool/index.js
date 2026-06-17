"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const LEGACY_PROMPT_PREFIXES = [
    '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：',
    '请把下面内容整理成行动清单，按优先级输出，避免空泛建议：',
    '请把下面内容改写成克制可信的小红书风格文案，包含标题、正文和标签：',
    '请把下面内容改写成适合朋友圈发布的短文案，语气自然、有信息密度：',
];
const MAX_IMAGE_DATA_URL_LENGTH = 2.5 * 1024 * 1024;
const MAX_FILE_TEXT_LENGTH = 6000;
let cloudbaseApp = null;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tcb = require('@cloudbase/node-sdk');
function ok(data) {
    return { code: constants_1.SUCCESS_CODE, message: 'ok', data };
}
function fail(message) {
    return { code: 400, message, data: null };
}
function sanitizeContent(value) {
    return LEGACY_PROMPT_PREFIXES.reduce((next, prefix) => next.split(prefix).join(''), String(value || '')).trim().slice(0, 6000);
}
function sanitizeImageDataUrl(value) {
    const imageDataUrl = String(value || '').trim();
    if (!imageDataUrl) {
        return '';
    }
    if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
        return '';
    }
    return imageDataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH ? imageDataUrl : '';
}
function sanitizeFileText(value) {
    return String(value || '').trim().slice(0, MAX_FILE_TEXT_LENGTH);
}
function sanitizeFileName(value) {
    return String(value || '').trim().replace(/[^\w.\-\u4e00-\u9fa5]/g, '').slice(0, 80);
}
function sanitizeFileType(value) {
    return String(value || '').trim().slice(0, 80);
}
function getFileExtension(fileName) {
    const normalized = String(fileName || '').split('?')[0].split('#')[0];
    const matched = normalized.match(/\.([a-z0-9]+)$/i);
    return matched ? matched[1].toLowerCase() : '';
}
function isImageFileExtension(extension) {
    return ['jpg', 'jpeg', 'png', 'webp'].includes(extension);
}
function normalizeOutputType(value) {
    if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
        return value;
    }
    return 'summary';
}
function stripMarkdown(markdown) {
    return markdown
        .replace(/!\[[^\]]*]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
        .replace(/[`*_>#-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function parseJsonObject(text) {
    const matched = text.match(/\{[\s\S]*}/);
    if (!matched)
        return null;
    try {
        const parsed = JSON.parse(matched[0]);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }
    catch (_a) {
        return null;
    }
}
function fallbackResult(content, outputType) {
    const plain = stripMarkdown(content);
    const title = plain.slice(0, 24) || '内容总结';
    const sentences = plain.split(/[。！？!?]/).map((item) => item.trim()).filter(Boolean);
    const points = (sentences.length ? sentences : [plain])
        .slice(0, 4)
        .map((item) => item.slice(0, 52));
    const summary = plain.slice(0, 120) || '暂无可总结内容';
    if (outputType === 'bullets') {
        return {
            title: '要点总结',
            summary,
            points,
            outputText: [
                '要点总结',
                '',
                ...points.map((item, index) => `${index + 1}. ${item}`),
                '',
            ].join('\n'),
        };
    }
    if (outputType === 'xiaohongshu') {
        return {
            title: `${title}｜值得关注`,
            summary,
            points,
            outputText: [
                `${title}，这件事值得关注`,
                '',
                summary,
                '',
                points.map((item) => `- ${item}`).join('\n'),
                '',
                '#AI工具 #AI资讯 #效率提升',
            ].join('\n'),
        };
    }
    if (outputType === 'moments') {
        return {
            title: '朋友圈文案',
            summary,
            points,
            outputText: [
                `今天看到一个 AI 相关变化：${summary}`,
                '',
                points.length ? `我觉得最值得关注的是：${points[0]}` : '',
                '',
                '先记录一下，后面继续观察实际影响。',
            ].filter(Boolean).join('\n'),
        };
    }
    return {
        title,
        summary,
        points,
        outputText: `摘要总结\n\n${summary}`,
    };
}
function getCloudBaseAi() {
    if (!cloudbaseApp) {
        cloudbaseApp = tcb.init({
            env: process.env.CLOUDBASE_ENV || process.env.TCB_ENV || process.env.TCB_ENV_ID,
            timeout: 60000,
        });
    }
    return cloudbaseApp.ai();
}
function buildPrompt(content, outputType, hasImage, hasFile) {
    const task = {
        summary: '只做摘要总结。outputText 必须是一段 120-180 字中文摘要，不要输出行动清单、标签或社交媒体文案。',
        bullets: '只做要点总结。outputText 标题必须叫“要点总结”，并使用 1. 2. 3. 编号列出 4-6 条重点。不要写“行动清单”，不要输出行动建议标题。',
        xiaohongshu: '只做小红书风格文案。outputText 必须包含吸引人的标题、分段正文和 3-5 个 #标签，语气克制自然，不夸大。',
        moments: '只做朋友圈短文案。outputText 必须是 80-140 字自然口吻短文，不要编号，不要小红书标签。',
    }[outputType];
    const imageInstruction = hasImage
        ? '用户上传了参考图片。请只依据图片中真实可见的内容来分析，优先读取文字、主体、界面、物体、场景和布局。看不清、看不全或者无法识别的部分必须明确说明“不确定/看不清”，不要猜测品牌、地点、数字、身份或背景故事。'
        : '';
    const fileInstruction = hasFile
        ? '用户上传了文本文件。文件内容已经附在用户输入中。必须优先基于文件内容生成结果，输出必须体现文件里的具体信息，不要只根据用户描述泛泛生成。'
        : '';
    return `请基于用户输入完成任务：${task}
${imageInstruction}
${fileInstruction}

四种 outputType 的结果必须明显不同。只输出 JSON，不要输出 Markdown。格式：
{"title":"不超过24字","summary":"80-120字摘要","points":["要点1","要点2","要点3"],"outputText":"可直接复制使用的完整文本"}

用户输入：
${content}`;
}
async function generateByAi(content, outputType, imageDataUrl, hasFile) {
    var _a;
    try {
        const model = imageDataUrl
            ? process.env.TCB_AI_VISION_MODEL || 'deepseek-v4-pro'
            : process.env.TCB_AI_MODEL || 'hy3-preview';
        const prompt = buildPrompt(content, outputType, Boolean(imageDataUrl), hasFile);
        const userContent = imageDataUrl
            ? [
                { type: 'image_url', image_url: { url: imageDataUrl } },
                { type: 'text', text: prompt },
            ]
            : prompt;
        const cloudbaseModel = getCloudBaseAi().createModel('cloudbase');
        const result = await cloudbaseModel.generateText({
            model,
            temperature: 0.45,
            messages: [
                {
                    role: 'user',
                    content: userContent,
                },
            ],
        });
        const parsed = parseJsonObject((_a = result.text) !== null && _a !== void 0 ? _a : '');
        const title = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.title) === 'string' ? parsed.title.trim().slice(0, 48) : '';
        const summary = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.summary) === 'string' ? parsed.summary.trim().slice(0, 240) : '';
        const outputText = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.outputText) === 'string' ? parsed.outputText.trim().slice(0, 2000) : '';
        const points = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.points)
            ? parsed.points.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 6)
            : [];
        if (imageDataUrl
            && /图片理解失败|无法读取参考图片|无法读取图片/.test(`${title}${summary}${outputText}`)) {
            return { result: null, errorMessage: '模型没有成功读取图片，请确认视觉模型支持 image_url 输入，或改用 deepseek-v4-pro' };
        }
        return title && summary && outputText
            ? { result: { title, summary, points, outputText }, errorMessage: '' }
            : { result: null, errorMessage: 'AI 返回格式不完整' };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('ai.tool.summary.generate.failed', errorMessage);
        return { result: null, errorMessage };
    }
}
async function main(event = {}) {
    const content = sanitizeContent(event.content);
    const outputType = normalizeOutputType(event.outputType);
    const imageDataUrl = sanitizeImageDataUrl(event.imageDataUrl);
    const fileText = sanitizeFileText(event.fileText);
    const fileName = sanitizeFileName(event.fileName);
    const fileType = sanitizeFileType(event.fileType);
    const fileExtension = getFileExtension(fileName);
    const isImageFile = isImageFileExtension(fileExtension);
    const hasFile = Boolean(fileText);
    if (isImageFile && !imageDataUrl) {
        return fail('图片素材过大、格式不正确或未能完整上传，请压缩后重试');
    }
    const fileContext = hasFile
        ? [
            content,
            '',
            `上传文件：${fileName || '未命名文件'}${fileType ? `（${fileType}）` : ''}`,
            '文件内容：',
            fileText,
        ].join('\n')
        : content;
    if (!imageDataUrl && !hasFile && content.length === 0) {
        return fail('请输入内容或添加素材');
    }
    console.info('ai.tool.summary.material.received', {
        hasImage: Boolean(imageDataUrl),
        hasFile,
        fileName: fileName || '',
        fileTextLength: fileText.length,
        outputType,
    });
    const fallbackContent = imageDataUrl || hasFile ? `用户上传了参考素材。用户描述：${fileContext}` : content;
    const generated = await generateByAi(fileContext, outputType, imageDataUrl, hasFile);
    if (generated.result) {
        return ok(generated.result);
    }
    if (imageDataUrl || hasFile) {
        return fail(`参考素材解析失败：${generated.errorMessage || '请更换素材或补充文字描述'}`);
    }
    return ok(fallbackResult(fallbackContent, outputType));
}
