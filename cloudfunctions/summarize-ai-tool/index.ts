import https from 'node:https';
import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';

type OutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments';

interface Event {
  content?: string;
  outputType?: OutputType;
}

interface ToolResult {
  title: string;
  summary: string;
  points: string[];
  outputText: string;
}

const LEGACY_PROMPT_PREFIXES = [
  '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：',
  '请把下面内容整理成行动清单，按优先级输出，避免空泛建议：',
  '请把下面内容改写成克制可信的小红书风格文案，包含标题、正文和标签：',
  '请把下面内容改写成适合朋友圈发布的短文案，语气自然、有信息密度：',
];

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

function fail(message: string): ApiResponse<null> {
  return { code: 400, message, data: null };
}

function sanitizeContent(value?: string): string {
  return LEGACY_PROMPT_PREFIXES.reduce(
    (next, prefix) => next.split(prefix).join(''),
    String(value || ''),
  ).trim().slice(0, 6000);
}

function normalizeOutputType(value?: string): OutputType {
  if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
    return value;
  }
  return 'summary';
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const matched = text.match(/\{[\s\S]*}/);
  if (!matched) return null;
  try {
    const parsed = JSON.parse(matched[0]) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function fallbackResult(content: string, outputType: OutputType): ToolResult {
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

function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(url, {
      method: 'POST',
      headers: {
        ...headers,
        'content-length': Buffer.byteLength(payload),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`AI 调用失败：${response.statusCode} ${text.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error('AI 返回非 JSON'));
        }
      });
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function buildPrompt(content: string, outputType: OutputType): string {
  const task = {
    summary: '只做摘要总结。outputText 必须是一段 120-180 字中文摘要，不要输出行动清单、标签或社交媒体文案。',
    bullets: '只做要点总结。outputText 标题必须叫“要点总结”，并使用 1. 2. 3. 编号列出 4-6 条重点。不要写“行动清单”，不要输出行动建议标题。',
    xiaohongshu: '只做小红书风格文案。outputText 必须包含吸引人的标题、分段正文和 3-5 个 #标签，语气克制自然，不夸大。',
    moments: '只做朋友圈短文案。outputText 必须是 80-140 字自然口吻短文，不要编号，不要小红书标签。',
  }[outputType];
  return `请基于用户输入完成任务：${task}

四种 outputType 的结果必须明显不同。只输出 JSON，不要输出 Markdown。格式：
{"title":"不超过24字","summary":"80-120字摘要","points":["要点1","要点2","要点3"],"outputText":"可直接复制使用的完整文本"}

用户输入：
${content}`;
}

async function generateByAi(content: string, outputType: OutputType): Promise<ToolResult | null> {
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
    }) as { choices?: Array<{ message?: { content?: string } }> };

    const parsed = parseJsonObject(result.choices?.[0]?.message?.content ?? '');
    const title = typeof parsed?.title === 'string' ? parsed.title.trim().slice(0, 48) : '';
    const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim().slice(0, 240) : '';
    const outputText = typeof parsed?.outputText === 'string' ? parsed.outputText.trim().slice(0, 2000) : '';
    const points = Array.isArray(parsed?.points)
      ? parsed.points.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 6)
      : [];
    return title && summary && outputText ? { title, summary, points, outputText } : null;
  } catch (error) {
    console.warn('ai.tool.summary.generate.failed', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function main(event: Event = {}) {
  const content = sanitizeContent(event.content);
  const outputType = normalizeOutputType(event.outputType);
  if (content.length < 20) {
    return fail('请输入至少 20 个字的内容');
  }
  const result = (await generateByAi(content, outputType)) ?? fallbackResult(content, outputType);
  return ok(result);
}
