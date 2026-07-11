"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallbackTextResult = fallbackTextResult;
exports.buildAiToolContent = buildAiToolContent;
exports.generateAiToolText = generateAiToolText;
let cloudbaseApp = null;
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
function fallbackTextResult(content, outputType) {
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const tcb = require('@cloudbase/node-sdk');
        cloudbaseApp = tcb.init({
            env: process.env.CLOUDBASE_ENV || process.env.TCB_ENV || process.env.TCB_ENV_ID,
            timeout: 60000,
        });
    }
    if (typeof cloudbaseApp.ai !== 'function') {
        throw new Error('CloudBase AI SDK unavailable: @cloudbase/node-sdk must be 3.18.4 or newer');
    }
    return cloudbaseApp.ai();
}
function buildAiToolContent(input) {
    if (!input.fileText) {
        return input.text;
    }
    return [
        input.text,
        '',
        `上传文件：${input.fileName || '未命名文件'}${input.fileType ? `（${input.fileType}）` : ''}`,
        '文件内容：',
        input.fileText,
    ].join('\n');
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
async function generateAiToolText(input) {
    var _a;
    const modelName = input.imageDataUrl
        ? process.env.TCB_AI_VISION_MODEL || 'deepseek-v4-pro'
        : process.env.TCB_AI_MODEL || 'hy3-preview';
    try {
        const content = buildAiToolContent(input);
        const prompt = buildPrompt(content, input.outputType, Boolean(input.imageDataUrl), Boolean(input.fileText));
        const userContent = input.imageDataUrl
            ? [
                { type: 'image_url', image_url: { url: input.imageDataUrl } },
                { type: 'text', text: prompt },
            ]
            : prompt;
        const cloudbaseModel = getCloudBaseAi().createModel('cloudbase');
        const result = await cloudbaseModel.generateText({
            model: modelName,
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
        if (input.imageDataUrl
            && /图片理解失败|无法读取参考图片|无法读取图片/.test(`${title}${summary}${outputText}`)) {
            return {
                result: null,
                errorMessage: '模型没有成功读取图片，请确认视觉模型支持 image_url 输入，或改用 deepseek-v4-pro',
                modelProvider: 'cloudbase',
                modelName,
            };
        }
        return title && summary && outputText
            ? {
                result: { title, summary, points, outputText },
                errorMessage: '',
                modelProvider: 'cloudbase',
                modelName,
            }
            : {
                result: null,
                errorMessage: 'AI 返回格式不完整',
                modelProvider: 'cloudbase',
                modelName,
            };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('ai.tool.generate.failed', errorMessage);
        return {
            result: null,
            errorMessage,
            modelProvider: 'cloudbase',
            modelName,
        };
    }
}
