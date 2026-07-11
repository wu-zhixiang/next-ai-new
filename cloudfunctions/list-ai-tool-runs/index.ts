import type { ApiResponse } from '../shared/types';
import { SUCCESS_CODE } from '../shared/constants';
import { listAiToolRuns } from '../shared/ai-tool-service';
import type { RunAiToolResult } from '../shared/ai-tool-core';
import { getWxContext } from '../_lib/context';

interface Event {
  toolId?: string;
  limit?: number;
}

interface ListAiToolRunsResult {
  runs: RunAiToolResult[];
}

function ok<T>(data: T): ApiResponse<T> {
  return { code: SUCCESS_CODE, message: 'ok', data };
}

function fail(message: string): ApiResponse<null> {
  return { code: 400, message, data: null };
}

export async function main(event: Event = {}): Promise<ApiResponse<ListAiToolRunsResult | null>> {
  const { OPENID } = getWxContext();
  const result = await listAiToolRuns(
    {
      toolId: event.toolId,
      limit: event.limit,
    },
    OPENID,
  );
  if (result.ok === false) {
    return fail(result.message);
  }
  return ok({ runs: result.data });
}
