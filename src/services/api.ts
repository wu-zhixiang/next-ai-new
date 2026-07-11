import Taro from '@tarojs/taro';
import type { ApiResponse } from '@/types';

export class CloudFunctionResponseError<TData = unknown> extends Error {
  code: number;
  data: TData | null;

  constructor(response: ApiResponse<TData>) {
    super(response.message);
    this.name = 'CloudFunctionResponseError';
    this.code = response.code;
    this.data = response.data ?? null;
  }
}

export async function callCloudFunction<TData, TEvent extends Record<string, unknown> = Record<string, unknown>>(
  name: string,
  data?: TEvent,
): Promise<TData> {
  const result = (await Taro.cloud.callFunction({
    name,
    data,
  })) as { result?: ApiResponse<TData> };

  const response = result.result;
  if (!response) {
    throw new Error('云函数无返回结果');
  }
  if (response.code !== 0) {
    throw new CloudFunctionResponseError(response as ApiResponse<unknown>);
  }

  return response.data;
}
