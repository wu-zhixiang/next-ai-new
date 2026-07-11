import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';
import { executeAiTool } from '../shared/ai-tool-service';
import type { AiToolErrorCode, RunAiToolInput, RunAiToolResult } from '../shared/ai-tool-core';
import { getWxContext } from '../_lib/context';

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

interface RunAiToolErrorData {
  code: AiToolErrorCode;
  [key: string]: unknown;
}

function fail(message: string, data: RunAiToolErrorData): ApiResponse<RunAiToolErrorData> {
  return { code: 400, message, data };
}

export async function main(event: RunAiToolInput = {}): Promise<ApiResponse<RunAiToolResult | RunAiToolErrorData>> {
  const { OPENID } = getWxContext();
  const result = await executeAiTool(event, OPENID);
  if (result.ok === false) {
    return fail(result.message, {
      code: result.code,
      ...(typeof result.data === 'object' && result.data !== null ? result.data : {}),
    });
  }
  return ok(result.data.result);
}
