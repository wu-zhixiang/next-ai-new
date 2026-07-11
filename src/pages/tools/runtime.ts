import { callCloudFunction } from '@/services/api';
import {
  TOOLS,
  mergeRemoteToolDefinitions,
  sortToolDefinitions,
  type RemoteToolDefinition,
  type ToolDefinition,
} from './definitions';

export async function loadConfiguredTools(source = 'unknown'): Promise<ToolDefinition[]> {
  console.info('ai.tools.config.request.start', { source });
  try {
    const remoteTools = await callCloudFunction<RemoteToolDefinition[]>('list-ai-tools');
    const tools = sortToolDefinitions(mergeRemoteToolDefinitions(remoteTools));
    console.info('ai.tools.config.request.success', { source, count: tools.length });
    return tools;
  } catch (error) {
    console.warn('ai.tools.config.request.failed', { source, error });
    return sortToolDefinitions(TOOLS);
  }
}
