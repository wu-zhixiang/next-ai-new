import Taro from '@tarojs/taro';
import type { ApiResponse } from '@/types';

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
    throw new Error(response.message);
  }

  return response.data;
}
