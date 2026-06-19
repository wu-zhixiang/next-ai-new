import puppeteer from '@cloudflare/puppeteer';

export default {
  async fetch(request, env, ctx) {
    return new Response('openai-code-parser ok', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },

  async email(message, env, ctx) {
    const to = String(message.to || '').toLowerCase();
    const from = String(message.from || '').toLowerCase();
    const subject = message.headers?.get?.('subject') || '';
    const raw = await streamToText(message.raw);
    const isApple = /apple/i.test(from) || /apple/i.test(subject);
    const isClaude = /anthropic|claude/i.test(from) || /claude/i.test(subject);
    const parsed = isClaude
      ? { code: '', candidates: [] }
      : extractCode(raw, { isApple });
    const loginUrl = isClaude ? extractClaudeLoginUrl(raw) : '';
    let code = parsed.code;

    if (isClaude && !code && loginUrl) {
      try {
        code = await extractClaudeCodeWithBrowser(env, loginUrl);
      } catch (error) {
        console.error({
          event: 'email.claude.browser.failed',
          to,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log({
      event: 'email.code.parsed',
      to,
      from,
      subject,
      provider: isClaude ? 'claude' : isApple ? 'apple' : 'openai',
      hasCode: Boolean(code),
      codeFingerprint: code ? await fingerprintCode(code) : '',
      hasLoginUrl: Boolean(loginUrl),
      candidateCount: parsed.candidates.length,
      rawSize: raw.length,
    });

    ctx.waitUntil(message.forward('007xiangye@gmail.com'));

    if (!code) {
      return;
    }

    const webhookUrl = getRequiredWebhookUrl(env);
    const webhookSecret = getRequiredEnvValue(env, 'EMAIL_WEBHOOK_SECRET');
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-email-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({
        to,
        from,
        subject,
        code,
        candidates: parsed.candidates,
        receivedAt: Date.now(),
      }),
    });

    console.log({
      event: 'email.webhook.result',
      ok: resp.ok,
      status: resp.status,
      text: await resp.text(),
    });
  },
};

async function fingerprintCode(code) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest).slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getRequiredWebhookUrl(env) {
  const value = getRequiredEnvValue(env, 'GPT_PAY_EMAIL_WEBHOOK');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('GPT_PAY_EMAIL_WEBHOOK 不是合法 URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('GPT_PAY_EMAIL_WEBHOOK 必须使用 HTTPS');
  }
  return url.toString();
}

function getRequiredEnvValue(env, key) {
  const value = String(env?.[key] || '').trim();
  if (!value) {
    throw new Error(`${key} 未配置`);
  }
  return value;
}

async function extractClaudeCodeWithBrowser(env, loginUrl) {
  if (!env.BROWSER) {
    throw new Error('Browser Run binding BROWSER 未配置');
  }

  const browser = await puppeteer.launch(env.BROWSER);
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(loginUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    const deadline = Date.now() + 15000;
    let visibleText = '';
    let candidates = [];
    while (Date.now() < deadline) {
      visibleText = await page.evaluate(() => document.body?.innerText || '');
      const keywordCode = extractKeywordCode(visibleText);
      if (keywordCode) {
        return keywordCode;
      }
      candidates = getVisualCodeCandidates(visibleText);
      if (candidates.length === 1) {
        return candidates[0];
      }
      await sleep(500);
    }

    const html = await page.content();
    const finalUrl = page.url();
    const title = await page.title();
    console.warn({
      event: 'email.claude.browser.no-code',
      pageSignals: getClaudePageSignals(visibleText),
      candidateCount: candidates.length,
      htmlSize: html.length,
      textSize: visibleText.length,
      diagnostics: {
        ...getClaudePageDiagnostics(html, visibleText),
        title: redactSensitiveText(title).slice(0, 200),
        finalUrl: sanitizeUrlForLog(finalUrl),
      },
    });
    if (String(env.CLAUDE_DEBUG_HTML || '').toLowerCase() === 'true') {
      console.warn({
        event: 'email.claude.browser.html-debug',
        sanitizedHtml: sanitizeClaudeHtmlForLog(html),
      });
    }
    throw new Error(candidates.length > 1 ? 'Claude 页面存在多个验证码候选' : 'Claude 页面未找到验证码');
  } finally {
    await page?.close().catch(() => {});
    await browser.close();
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode();
  return result;
}

function extractClaudeLoginUrl(raw) {
  const content = decodeHtmlEntities(decodeEmailSource(raw));
  const anchors = Array.from(
    content.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
    (match) => ({
      url: normalizeClaudeUrl(match[1]),
      label: htmlToSearchText(match[2]).toLowerCase(),
    }),
  ).filter((anchor) => Boolean(anchor.url));

  const signInButton = anchors.find((anchor) =>
    /sign\s*in\s*to\s*claude(?:\.ai)?/.test(anchor.label)
    || /continue\s*(?:to|with)?\s*claude/.test(anchor.label),
  );
  if (signInButton) {
    return signInButton.url;
  }

  const candidates = [
    ...anchors.map((anchor) => anchor.url),
    ...Array.from(content.matchAll(/https:\/\/[^\s<>"']+/gi), (match) => normalizeClaudeUrl(match[0])),
  ].filter(Boolean);
  const allowedUrls = Array.from(new Set(candidates));
  allowedUrls.sort((left, right) => scoreClaudeLoginUrl(right) - scoreClaudeLoginUrl(left));
  const bestUrl = allowedUrls[0] || '';
  return scoreClaudeLoginUrl(bestUrl) >= 50 ? bestUrl : '';
}

function scoreClaudeLoginUrl(value) {
  if (!value) return 0;
  const url = new URL(value);
  const searchable = `${url.pathname}${url.search}`.toLowerCase();
  let score = 0;
  if (/(verify|verification|auth|login|signin|sign-in|magic|code)/.test(searchable)) score += 100;
  if (url.search.length > 1) score += 30;
  if (url.pathname !== '/' && url.pathname !== '') score += 20;
  score += Math.min(20, Math.floor(value.length / 40));
  return score;
}

function normalizeClaudeUrl(value) {
  let parsed;
  try {
    parsed = new URL(decodeHtmlEntities(value.trim()));
  } catch {
    return '';
  }

  if (isAllowedClaudeUrl(parsed)) {
    return parsed.toString();
  }

  for (const key of ['url', 'redirect', 'redirect_url', 'target', 'u']) {
    const nested = parsed.searchParams.get(key);
    if (!nested) continue;
    try {
      const nestedUrl = new URL(decodeURIComponent(nested));
      if (isAllowedClaudeUrl(nestedUrl)) {
        return nestedUrl.toString();
      }
    } catch {
      // Ignore malformed tracking parameters.
    }
  }
  return '';
}

function isAllowedClaudeUrl(url) {
  if (url.protocol !== 'https:') {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  return hostname === 'claude.ai'
    || hostname.endsWith('.claude.ai')
    || hostname === 'anthropic.com'
    || hostname.endsWith('.anthropic.com');
}

function extractCode(raw, options = {}) {
  const isApple = Boolean(options.isApple);
  const text = decodeEmailSource(raw);
  const compact = text.replace(/\s+/g, ' ');

  const keywordCode = extractKeywordCode(compact);
  if (keywordCode) {
    return {
      code: keywordCode,
      candidates: getCandidates(compact),
    };
  }

  const candidates = getCandidates(compact);
  return {
    code: isApple ? (candidates[0] || '') : (candidates[candidates.length - 1] || ''),
    candidates,
  };
}

function getCandidates(text) {
  return Array.from(new Set(text.match(/\b\d{6}\b/g) || []));
}

function getVisualCodeCandidates(text) {
  const candidates = new Set(getCandidates(text));
  const patterns = [
    /(?:verification code|temporary code|one-time code|login code|验证码|驗證碼)[\s\S]{0,220}?(\d(?:[\s\u00a0\-]{0,8}\d){5})/gi,
    /(\d(?:[\s\u00a0\-]{1,8}\d){5})/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const normalized = match[1].replace(/\D/g, '');
      if (/^\d{6}$/.test(normalized)) {
        candidates.add(normalized);
      }
    }
  }
  return Array.from(candidates);
}

function extractKeywordCode(text) {
  const patterns = [
    /(?:验证码|驗證碼|临时验证码|一次性代码)[^\d]{0,160}(\d{6})/i,
    /(?:verification code|temporary code|one-time code|login code|code)[^\d]{0,160}(\d{6})/i,
    /(\d{6})[^\d]{0,160}(?:验证码|驗證碼|verification code|temporary code|one-time code|login code)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return '';
}

function getClaudePageSignals(text) {
  const normalized = text.toLowerCase();
  return {
    hasClaude: normalized.includes('claude'),
    hasVerification: normalized.includes('verification'),
    hasContinue: normalized.includes('continue'),
    hasSignIn: normalized.includes('sign in') || normalized.includes('signin'),
    hasError: normalized.includes('error') || normalized.includes('expired') || normalized.includes('invalid'),
    hasChallenge: normalized.includes('challenge') || normalized.includes('captcha') || normalized.includes('verify you are human'),
  };
}

function getClaudePageDiagnostics(html, visibleText) {
  const title = decodeHtmlEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s+/g, ' ')
    .trim();
  const scriptSources = Array.from(
    html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi),
    (match) => sanitizeUrlForLog(match[1]),
  ).filter(Boolean).slice(0, 12);
  const rootElements = Array.from(
    html.matchAll(/<(?:main|div|section)\b[^>]*(?:id|class)\s*=\s*["']([^"']+)["'][^>]*>/gi),
    (match) => match[1].replace(/[^\w\s-]/g, '').trim(),
  ).filter(Boolean).slice(0, 20);

  return {
    title: redactSensitiveText(title).slice(0, 200),
    textPreview: redactSensitiveText(visibleText).slice(0, 500),
    scriptSources,
    rootElements,
  };
}

function sanitizeClaudeHtmlForLog(html) {
  return redactSensitiveText(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script>[removed]</script>')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style>[removed]</style>')
      .replace(/\s(href|src|action|value|data-[\w-]+)\s*=\s*(["'])[\s\S]*?\2/gi, ' $1=$2[redacted]$2')
      .replace(/\s+/g, ' '),
  ).slice(0, 4000);
}

function sanitizeUrlForLog(value) {
  try {
    const url = new URL(decodeHtmlEntities(value));
    return `${url.protocol}//${url.hostname}${url.pathname}`.slice(0, 300);
  } catch {
    return '';
  }
}

function redactSensitiveText(value) {
  return String(value || '')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrlForLog(url) || '[url]')
    .replace(/\b\d{4,}\b/g, '[digits]')
    .replace(/\b[a-z0-9_-]{24,}\b/gi, '[token]');
}

function htmlToSearchText(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function decodeQuotedPrintable(input) {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function decodeEmailSource(raw) {
  return /content-transfer-encoding\s*:\s*quoted-printable/i.test(raw)
    ? decodeQuotedPrintable(raw)
    : raw;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}
