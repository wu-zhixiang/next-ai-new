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
    const parsed = extractCode(raw, { isApple });

    console.log({
      event: 'email.code.parsed',
      to,
      from,
      subject,
      hasCode: Boolean(parsed.code),
      code: parsed.code,
      candidates: parsed.candidates,
      rawSize: raw.length,
    });

    ctx.waitUntil(message.forward('007xiangye@gmail.com'));

    if (!parsed.code) {
      return;
    }

    const resp = await fetch(env.GPT_PAY_EMAIL_WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-email-webhook-secret': env.EMAIL_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        to,
        from,
        subject,
        code: parsed.code,
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

function extractCode(raw, options = {}) {
  const isApple = Boolean(options.isApple);
  const text = decodeQuotedPrintable(raw);
  const compact = text.replace(/\s+/g, ' ');

  const patterns = [
    /(?:验证码|驗證碼|临时验证码|一次性代码)[^\d]{0,120}(\d{6})/i,
    /(?:verification code|temporary code|one-time code|login code|code)[^\d]{0,120}(\d{6})/i,
    /(\d{6})[^\d]{0,120}(?:验证码|驗證碼|verification code|temporary code|one-time code|login code)/i,
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match?.[1]) {
      return {
        code: match[1],
        candidates: getCandidates(compact),
      };
    }
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

function decodeQuotedPrintable(input) {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}
