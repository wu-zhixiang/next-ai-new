import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';
import { getAiToolRun } from '../shared/ai-tool-service';
import type { RunAiToolResult } from '../shared/ai-tool-core';
import { getWxContext } from '../_lib/context';

interface Event {
  runId?: string;
}

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

function fail(message: string): ApiResponse<null> {
  return { code: 400, message, data: null };
}

export async function main(event: Event = {}): Promise<ApiResponse<RunAiToolResult | null>> {
  const { OPENID } = getWxContext();
  const result = await getAiToolRun(event.runId || '', OPENID);
  if (result.ok === false) {
    return fail(result.message);
  }
  return ok(result.data);
}
