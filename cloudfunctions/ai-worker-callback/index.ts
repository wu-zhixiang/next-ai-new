import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';
import {
  getImageWorkerConfig,
  parseMultipartFormData,
  sha256Hex,
  uploadAiToolResultImage,
  verifyWorkerSignature,
} from '../shared/ai-image-worker';
import {
  markAiToolImageRunFailed,
  markAiToolImageRunSucceeded,
} from '../shared/ai-tool-service';

interface HttpEvent {
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface ParsedCallbackBody {
  fields: Record<string, string>;
  files: ReturnType<typeof parseMultipartFormData>['files'];
}

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

function fail(message: string): ApiResponse<null> {
  return { code: 400, message, data: null };
}

function getHeader(headers: Record<string, string | undefined>, name: string): string {
  const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return matched?.[1] || '';
}

function getBodyBuffer(event: HttpEvent): Buffer {
  const body = event.body || '';
  return Buffer.from(body, event.isBase64Encoded ? 'base64' : 'utf8');
}

function parseUrlEncodedFormData(bodyBuffer: Buffer): ParsedCallbackBody {
  const params = new URLSearchParams(bodyBuffer.toString('utf8'));
  const fields: Record<string, string> = {};
  params.forEach((value, key) => {
    fields[key] = value;
  });
  return { fields, files: {} };
}

function parseCallbackBody(bodyBuffer: Buffer, contentType: string): ParsedCallbackBody {
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    return parseMultipartFormData(bodyBuffer, contentType);
  }
  if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    return parseUrlEncodedFormData(bodyBuffer);
  }
  throw new Error('不支持的回调 Content-Type');
}

function quotePythonString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function pythonOptionalString(value?: string): string {
  return value && value !== 'None' ? quotePythonString(value) : 'None';
}

function buildWorkerCallbackDataRepr(fields: Record<string, string>): string {
  const meta = fields.meta && fields.meta !== 'None' ? fields.meta : '{}';
  return [
    "{",
    `'taskId': ${quotePythonString(fields.taskId || '')}, `,
    `'status': ${quotePythonString(fields.status || '')}, `,
    `'errorCode': ${pythonOptionalString(fields.errorCode)}, `,
    `'message': ${pythonOptionalString(fields.message)}, `,
    `'meta': ${meta}`,
    "}",
  ].join('');
}

export async function main(event: HttpEvent = {}): Promise<ApiResponse<{ received: true; taskId: string } | null>> {
  const headers = event.headers || {};
  const contentType = getHeader(headers, 'content-type');
  const timestamp = getHeader(headers, 'x-timestamp');
  const nonce = getHeader(headers, 'x-nonce');
  const signature = getHeader(headers, 'x-signature');
  const bodyBuffer = getBodyBuffer(event);
  const parsed = parseCallbackBody(bodyBuffer, contentType);
  const taskId = parsed.fields.taskId || '';
  if (!taskId) {
    return fail('缺少 taskId');
  }

  const config = getImageWorkerConfig();
  if (!config.callbackSecret || config.callbackSecret === 'change_me') {
    return fail('AI_WORKER_CALLBACK_SECRET 未配置');
  }
  const callbackDataRepr = buildWorkerCallbackDataRepr(parsed.fields);
  const verified = verifyWorkerSignature({
    secret: config.callbackSecret,
    taskId,
    timestamp,
    nonce,
    signature,
    bodyHash: sha256Hex(callbackDataRepr),
  });
  if (!verified) {
    return fail('回调签名校验失败');
  }

  if (parsed.fields.status !== 'success') {
    await markAiToolImageRunFailed({
      runId: taskId,
      errorCode: parsed.fields.errorCode || 'MODEL_FAILED',
      message: parsed.fields.message || '图片处理失败',
    });
    return ok({ received: true, taskId });
  }

  const resultFile = parsed.files.resultFile;
  if (!resultFile?.buffer.length) {
    await markAiToolImageRunFailed({
      runId: taskId,
      errorCode: 'EMPTY_RESULT',
      message: 'worker 未返回结果图片',
    });
    return ok({ received: true, taskId });
  }

  const upload = await uploadAiToolResultImage({
    runId: taskId,
    filename: resultFile.filename || 'result.jpg',
    buffer: resultFile.buffer,
  });
  await markAiToolImageRunSucceeded({
    runId: taskId,
    fileId: upload.fileId,
    message: parsed.fields.message || undefined,
  });
  return ok({ received: true, taskId });
}
