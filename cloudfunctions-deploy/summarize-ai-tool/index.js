"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const node_https_1 = __importDefault(require("node:https"));
const SUCCESS_CODE = 0;
function ok(data) {
    return { code: SUCCESS_CODE, message: 'ok', data };
}
function fail(message) {
    return { code: 400, message, data: null };
}
function sanitizeContent(value) {
    return String(value || '').trim().slice(0, 6000);
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
    const prefix = outputType === 'xiaohongshu'
        ? '小红书文案'
        : outputType === 'moments'
            ? '朋友圈文案'
            : outputType === 'bullets'
                ? '要点总结'
                : '摘要总结';
    return {
        title,
        summary,
        points,
        outputText: `${prefix}\n\n${summary}\n\n${points.map((item) => `- ${item}`).join('\n')}`,
    };
}
function postJson(url, headers, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const request = node_https_1.default.request(url, {
            method: 'POST',
            headers: {
                ...headers,
                'content-length': Buffer.byteLength(payload),
            },
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                var _a;
                const text = Buffer.concat(chunks).toString('utf8');
                if (((_a = response.statusCode) !== null && _a !== void 0 ? _a : 500) >= 400) {
                    reject(new Error(`AI 调用失败：${response.statusCode} ${text.slice(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(text));
                }
                catch (_b) {
                    reject(new Error('AI 返回非 JSON'));
                }
            });
        });
        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}
function buildPrompt(content, outputType) {
    const task = {
        summary: '生成适合普通用户快速阅读的摘要。',
        bullets: '提炼 4-6 条重点，突出结论和可执行建议。',
        xiaohongshu: '改写成小红书风格文案，包含标题、正文和标签，克制自然，不夸大。',
        moments: '改写成适合朋友圈发布的短文案，语气自然，有信息密度。',
    }[outputType];
    return `请基于用户输入完成任务：${task}

只输出 JSON，不要输出 Markdown。格式：
{"title":"不超过24字","summary":"80-120字摘要","points":["要点1","要点2","要点3"],"outputText":"可直接复制使用的完整文本"}

用户输入：
${content}`;
}
async function generateByAi(content, outputType) {
    var _a, _b, _c, _d;
    const apiKey = process.env.TCB_AI_API_KEY;
    const baseUrl = process.env.TCB_AI_BASE_URL;
    if (!apiKey || !baseUrl) {
        return null;
    }
    try {
        const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const model = process.env.TCB_AI_MODEL || 'hy3-preview';
        const result = await postJson(endpoint, {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        }, {
            model,
            temperature: 0.45,
            messages: [
                { role: 'system', content: '你是面向中文用户的 AI 内容整理助手。输出必须是合法 JSON。' },
                { role: 'user', content: buildPrompt(content, outputType) },
            ],
        });
        const parsed = parseJsonObject((_d = (_c = (_b = (_a = result.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : '');
        const title = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.title) === 'string' ? parsed.title.trim().slice(0, 48) : '';
        const summary = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.summary) === 'string' ? parsed.summary.trim().slice(0, 240) : '';
        const outputText = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.outputText) === 'string' ? parsed.outputText.trim().slice(0, 2000) : '';
        const points = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.points)
            ? parsed.points.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 6)
            : [];
        return title && summary && outputText ? { title, summary, points, outputText } : null;
    }
    catch (error) {
        console.warn('ai.tool.summary.generate.failed', error instanceof Error ? error.message : String(error));
        return null;
    }
}
async function main(event = {}) {
    var _a;
    const content = sanitizeContent(event.content);
    const outputType = normalizeOutputType(event.outputType);
    if (content.length < 20) {
        return fail('请输入至少 20 个字的内容');
    }
    const result = (_a = (await generateByAi(content, outputType))) !== null && _a !== void 0 ? _a : fallbackResult(content, outputType);
    return ok(result);
}
