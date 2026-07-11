import { randomBytes } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

import { app } from './db';
import {
  parseImageDataUrl,
  parseMultipartFormData,
  sha256Hex,
  signWorkerPayload,
  verifyWorkerSignature,
} from './ai-image-worker-core';

export {
  parseImageDataUrl,
  parseMultipartFormData,
  sha256Hex,
  signWorkerPayload,
  verifyWorkerSignature,
};

export interface ImageWorkerConfig {
  baseUrl: string;
  workerSecret: string;
  callbackUrl: string;
  callbackSecret: string;
}

export interface WorkerJobRequest {
  taskId: string;
  type: 'workflow.old_photo_restore';
  callbackUrl: string;
  input: {
    imageUrl: string;
  };
  options: {
    model?: string;
    outputFormat?: 'jpg' | 'png' | 'webp';
    quality?: string;
  };
}

export interface WorkerJobAcceptedResponse {
  ok?: boolean;
  taskId?: string;
  status?: string;
}

export function getImageWorkerConfig(): ImageWorkerConfig {
  return {
    baseUrl: (process.env.AI_WORKER_BASE_URL || 'https://wechat.aionhub.net').replace(/\/+$/, ''),
    workerSecret: process.env.AI_WORKER_SHARED_SECRET || '',
    callbackUrl: process.env.AI_WORKER_CALLBACK_URL || '',
    callbackSecret: process.env.AI_WORKER_CALLBACK_SECRET || '',
  };
}

export async function uploadAiToolSourceImage(params: {
  userId: string;
  runId: string;
  imageDataUrl: string;
}): Promise<{ fileId: string; tempFileURL: string }> {
  const parsed = parseImageDataUrl(params.imageDataUrl);
  if (!parsed) {
    throw new Error('请上传 jpg、png 或 webp 图片');
  }
  const random = randomBytes(6).toString('hex');
  const cloudPath = `ai-tools/source/${params.userId}/${params.runId}-${random}.${parsed.extension}`;
  const upload = await app.uploadFile({
    cloudPath,
    fileContent: parsed.buffer,
  });
  const tempUrl = await app.getTempFileURL({
    fileList: [{ fileID: upload.fileID, maxAge: 30 * 60 }],
  });
  const tempFileURL = tempUrl.fileList[0]?.tempFileURL;
  if (!tempFileURL) {
    throw new Error('生成图片临时访问链接失败');
  }
  return {
    fileId: upload.fileID,
    tempFileURL,
  };
}

export async function getAiToolSourceImageTempUrl(fileId: string): Promise<{ fileId: string; tempFileURL: string }> {
  const normalizedFileId = String(fileId || '').trim();
  if (!normalizedFileId) {
    throw new Error('请先上传需要修复的旧照片');
  }
  const tempUrl = await app.getTempFileURL({
    fileList: [{ fileID: normalizedFileId, maxAge: 30 * 60 }],
  });
  const tempFileURL = tempUrl.fileList[0]?.tempFileURL;
  if (!tempFileURL) {
    throw new Error('生成图片临时访问链接失败');
  }
  return {
    fileId: normalizedFileId,
    tempFileURL,
  };
}

export async function uploadAiToolResultImage(params: {
  runId: string;
  filename: string;
  buffer: Buffer;
}): Promise<{ fileId: string }> {
  const extension = getImageExtensionFromName(params.filename);
  const random = randomBytes(6).toString('hex');
  const upload = await app.uploadFile({
    cloudPath: `ai-tools/results/${params.runId}-${random}.${extension}`,
    fileContent: params.buffer,
  });
  return { fileId: upload.fileID };
}

function getImageExtensionFromName(filename: string): 'jpg' | 'png' | 'webp' {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension === 'png') return 'png';
  if (extension === 'webp') return 'webp';
  return 'jpg';
}

export async function submitOldPhotoRestoreJob(params: {
  runId: string;
  inputImageUrl: string;
  model: string;
  config?: ImageWorkerConfig;
}): Promise<WorkerJobAcceptedResponse> {
  const config = params.config ?? getImageWorkerConfig();
  if (!config.workerSecret || config.workerSecret === 'change_me') {
    throw new Error('AI_WORKER_SHARED_SECRET 未配置');
  }
  if (!config.callbackUrl) {
    throw new Error('AI_WORKER_CALLBACK_URL 未配置');
  }
  const body: WorkerJobRequest = {
    taskId: params.runId,
    type: 'workflow.old_photo_restore',
    callbackUrl: config.callbackUrl,
    input: {
      imageUrl: params.inputImageUrl,
    },
    options: {
      model: params.model,
      outputFormat: 'jpg',
      quality: 'high',
    },
  };
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString('hex');
  const signature = signWorkerPayload({
    secret: config.workerSecret,
    taskId: params.runId,
    timestamp,
    nonce,
    rawBody,
  });
  return postJson<WorkerJobAcceptedResponse>(`${config.baseUrl}/v1/jobs`, rawBody, {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(rawBody)),
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature,
  });
}

async function postJson<T>(url: string, body: string, headers: Record<string, string>): Promise<T> {
  const target = new URL(url);
  const client = target.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers,
        timeout: 30000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
            reject(new Error(`AI worker 请求失败：${response.statusCode} ${text.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch {
            reject(new Error('AI worker 返回格式异常'));
          }
        });
      },
    );
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('AI worker 请求超时'));
    });
    request.write(body);
    request.end();
  });
}
