import { HttpClient } from './http';
import type {
  AiNewsInput,
  AiNewsRecord,
  AiToolInput,
  AiToolRecord,
  AdminFileInput,
  AdminFileRecord,
  DashboardData,
  MemberPlanInput,
  MemberPlanRecord,
  OrderRecord,
  OrderUpdateInput,
  PointsConfigInput,
  PointsConfigRecord,
  ProductTypeInput,
  ProductTypeRecord,
  UploadFileChunkResult,
  UploadFileResult,
  UploadToolImageChunkResult,
  UploadToolImageResult,
  UserRecord,
  UserUpdateInput,
} from '../types/admin';

const ADMIN_UPLOAD_CHUNK_BYTES = 384 * 1024;

function createUploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export interface AdminApiConfig {
  readonly baseUrl: string;
  readonly token: string;
}

export class AdminApi {
  private readonly http: HttpClient;

  constructor(config: AdminApiConfig) {
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      token: config.token,
    });
  }

  getDashboard(): Promise<DashboardData> {
    return this.http.request<DashboardData>('/dashboard');
  }

  getPointsConfig(): Promise<PointsConfigRecord> {
    return this.http.request<PointsConfigRecord>('/points-config');
  }

  updatePointsConfig(input: PointsConfigInput): Promise<PointsConfigRecord> {
    return this.http.request<PointsConfigRecord>('/points-config', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  listUsers(): Promise<readonly UserRecord[]> {
    return this.http.request<readonly UserRecord[]>('/users');
  }

  updateUser(id: string, input: UserUpdateInput): Promise<readonly UserRecord[]> {
    return this.http.request<readonly UserRecord[]>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deleteUser(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  listOrders(): Promise<readonly OrderRecord[]> {
    return this.http.request<readonly OrderRecord[]>('/orders');
  }

  updateOrder(id: string, input: OrderUpdateInput): Promise<readonly OrderRecord[]> {
    return this.http.request<readonly OrderRecord[]>(`/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deleteOrder(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  listNews(): Promise<readonly AiNewsRecord[]> {
    return this.http.request<readonly AiNewsRecord[]>('/news');
  }

  createNews(input: AiNewsInput): Promise<readonly AiNewsRecord[]> {
    return this.http.request<readonly AiNewsRecord[]>('/news', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateNews(id: string, input: AiNewsInput): Promise<readonly AiNewsRecord[]> {
    return this.http.request<readonly AiNewsRecord[]>(`/news/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deleteNews(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/news/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  listProductTypes(): Promise<readonly ProductTypeRecord[]> {
    return this.http.request<readonly ProductTypeRecord[]>('/product-types');
  }

  createProductType(input: ProductTypeInput): Promise<readonly ProductTypeRecord[]> {
    return this.http.request<readonly ProductTypeRecord[]>('/product-types', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateProductType(id: string, input: ProductTypeInput): Promise<readonly ProductTypeRecord[]> {
    return this.http.request<readonly ProductTypeRecord[]>(`/product-types/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deleteProductType(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/product-types/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  listPlans(): Promise<readonly MemberPlanRecord[]> {
    return this.http.request<readonly MemberPlanRecord[]>('/plans');
  }

  createPlan(input: MemberPlanInput): Promise<readonly MemberPlanRecord[]> {
    return this.http.request<readonly MemberPlanRecord[]>('/plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updatePlan(id: string, input: MemberPlanInput): Promise<readonly MemberPlanRecord[]> {
    return this.http.request<readonly MemberPlanRecord[]>(`/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deletePlan(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  listTools(): Promise<readonly AiToolRecord[]> {
    return this.http.request<readonly AiToolRecord[]>('/tools');
  }

  createTool(input: AiToolInput): Promise<readonly AiToolRecord[]> {
    return this.http.request<readonly AiToolRecord[]>('/tools', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  updateTool(id: string, input: AiToolInput): Promise<readonly AiToolRecord[]> {
    return this.http.request<readonly AiToolRecord[]>(`/tools/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deleteTool(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/tools/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  uploadToolImage(dataUrl: string): Promise<UploadToolImageResult> {
    return this.http.request<UploadToolImageResult>('/tool-assets', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
  }

  async uploadToolImageFile(file: File): Promise<UploadToolImageResult> {
    const result = await this.uploadChunks<UploadToolImageChunkResult>('/tool-assets/chunks', file, {});
    if (!result.fileId) {
      throw new Error('图片上传失败');
    }
    return { fileId: result.fileId };
  }

  listFiles(): Promise<readonly AdminFileRecord[]> {
    return this.http.request<readonly AdminFileRecord[]>('/files');
  }

  uploadFile(input: {
    readonly fileName: string;
    readonly dataUrl: string;
    readonly displayName: string;
    readonly usage: AdminFileInput['usage'];
    readonly note: string;
  }): Promise<UploadFileResult> {
    return this.http.request<UploadFileResult>('/files', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async uploadFileChunked(input: {
    readonly file: File;
    readonly displayName: string;
    readonly usage: AdminFileInput['usage'];
    readonly note: string;
  }): Promise<UploadFileResult> {
    const result = await this.uploadChunks<UploadFileChunkResult>('/files/chunks', input.file, {
      displayName: input.displayName,
      usage: input.usage,
      note: input.note,
    });
    if (!result.id || !result.fileId) {
      throw new Error('文件上传失败');
    }
    return result as UploadFileResult;
  }

  updateFile(id: string, input: AdminFileInput): Promise<AdminFileRecord> {
    return this.http.request<AdminFileRecord>(`/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  deleteFile(id: string): Promise<{ readonly deleted: true }> {
    return this.http.request<{ readonly deleted: true }>(`/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
  }

  private async uploadChunks<T extends { readonly done: boolean }>(
    path: string,
    file: File,
    extra: Record<string, unknown>,
  ): Promise<T> {
    const uploadId = createUploadId();
    const chunkCount = Math.max(1, Math.ceil(file.size / ADMIN_UPLOAD_CHUNK_BYTES));
    let latest: T | null = null;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const start = chunkIndex * ADMIN_UPLOAD_CHUNK_BYTES;
      const end = Math.min(file.size, start + ADMIN_UPLOAD_CHUNK_BYTES);
      const chunkData = arrayBufferToBase64(await file.slice(start, end).arrayBuffer());
      latest = await this.http.request<T>(path, {
        method: 'POST',
        body: JSON.stringify({
          ...extra,
          uploadId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          totalSize: file.size,
          chunkIndex,
          chunkCount,
          chunkData,
        }),
      });
    }
    if (!latest?.done) {
      throw new Error('上传分片未完成');
    }
    return latest;
  }
}
