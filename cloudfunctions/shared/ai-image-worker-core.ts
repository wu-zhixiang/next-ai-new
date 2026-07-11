import { createHash, createHmac } from 'node:crypto';

export interface ParsedImageDataUrl {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  buffer: Buffer;
}

export interface ParsedWorkerCallback {
  fields: Record<string, string>;
  files: Record<string, {
    filename: string;
    contentType: string;
    buffer: Buffer;
  }>;
}

export function parseImageDataUrl(value: string): ParsedImageDataUrl | null {
  const matched = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!matched) {
    return null;
  }
  const normalizedMime = matched[1] === 'image/jpg' ? 'image/jpeg' : matched[1];
  const mimeType = normalizedMime as ParsedImageDataUrl['mimeType'];
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  try {
    const buffer = Buffer.from(matched[2], 'base64');
    return buffer.length > 0 ? { mimeType, extension, buffer } : null;
  } catch {
    return null;
  }
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function signWorkerPayload(params: {
  secret: string;
  taskId: string;
  timestamp: string;
  nonce: string;
  rawBody: string | Buffer;
}): string {
  const bodyHash = sha256Hex(params.rawBody);
  const payload = `${params.taskId}${params.timestamp}${params.nonce}${bodyHash}`;
  return createHmac('sha256', params.secret).update(payload).digest('hex');
}

export function verifyWorkerSignature(params: {
  secret: string;
  taskId: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
  signature: string;
  maxSkewMs?: number;
  now?: number;
}): boolean {
  const timestampMs = Number(params.timestamp);
  if (!Number.isFinite(timestampMs)) {
    return false;
  }
  const skewMs = Math.abs((params.now ?? Date.now()) - timestampMs);
  if (skewMs > (params.maxSkewMs ?? 5 * 60 * 1000)) {
    return false;
  }
  const payload = `${params.taskId}${params.timestamp}${params.nonce}${params.bodyHash}`;
  const expected = createHmac('sha256', params.secret).update(payload).digest('hex');
  return expected === params.signature;
}

export function parseMultipartFormData(body: Buffer, contentType: string): ParsedWorkerCallback {
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
  if (!boundary) {
    throw new Error('缺少 multipart boundary');
  }
  const delimiter = `--${boundary}`;
  const text = body.toString('binary');
  const fields: Record<string, string> = {};
  const files: ParsedWorkerCallback['files'] = {};
  for (const rawPart of text.split(delimiter)) {
    const part = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '');
    if (!part || part === '--') {
      continue;
    }
    const separatorIndex = part.indexOf('\r\n\r\n');
    if (separatorIndex < 0) {
      continue;
    }
    const rawHeaders = part.slice(0, separatorIndex);
    let content = part.slice(separatorIndex + 4);
    if (content.endsWith('\r\n')) {
      content = content.slice(0, -2);
    }
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] ?? '';
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    if (!name) {
      continue;
    }
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    if (filename !== undefined) {
      const contentTypeHeader = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
      files[name] = {
        filename,
        contentType: contentTypeHeader,
        buffer: Buffer.from(content, 'binary'),
      };
    } else {
      fields[name] = Buffer.from(content, 'binary').toString('utf8');
    }
  }
  return { fields, files };
}
