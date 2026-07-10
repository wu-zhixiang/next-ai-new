import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';
import { executeAiTool } from '../shared/ai-tool-service';
import type { AiToolOutputType, RunAiToolInput } from '../shared/ai-tool-core';
import type { AiToolTextResult } from '../shared/ai-tool-generation';
import { getWxContext } from '../_lib/context';

interface Event {
  content?: string;
  outputType?: Exclude<AiToolOutputType, 'image'>;
  imageDataUrl?: string;
  fileText?: string;
  fileBase64?: string;
  fileName?: string;
  fileType?: string;
  adUnlocked?: boolean;
}

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

function fail(message: string): ApiResponse<null> {
  return { code: 400, message, data: null };
}

export async function main(event: Event = {}): Promise<ApiResponse<AiToolTextResult | null>> {
  const { OPENID } = getWxContext();
  const input: RunAiToolInput = {
    toolId: event.outputType === 'xiaohongshu' || event.outputType === 'moments' ? 'copywriting' : 'articleSummary',
    outputType: event.outputType,
    text: event.content,
    fileText: event.fileText,
    fileName: event.fileName,
    fileType: event.fileType,
    imageDataUrl: event.imageDataUrl,
    adUnlocked: event.adUnlocked,
    source: 'miniapp',
  };
  const result = await executeAiTool(input, OPENID);
  if (result.ok === false) {
    return fail(result.message);
  }
  return ok(result.data.textResult);
}
