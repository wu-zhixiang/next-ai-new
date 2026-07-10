import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';
import { executeAiTool } from '../shared/ai-tool-service';
import type { RunAiToolInput, RunAiToolResult } from '../shared/ai-tool-core';
import { getWxContext } from '../_lib/context';

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

function fail(message: string): ApiResponse<null> {
  return { code: 400, message, data: null };
}

export async function main(event: RunAiToolInput = {}): Promise<ApiResponse<RunAiToolResult | null>> {
  const { OPENID } = getWxContext();
  const result = await executeAiTool(event, OPENID);
  if (result.ok === false) {
    return fail(result.message);
  }
  return ok(result.data.result);
}
