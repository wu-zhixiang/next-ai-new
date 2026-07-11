import { HttpClient } from './http';
import type {
  AiNewsInput,
  AiNewsRecord,
  AiToolInput,
  AiToolRecord,
  DashboardData,
  MemberPlanInput,
  MemberPlanRecord,
  OrderRecord,
  OrderUpdateInput,
  PointsConfigInput,
  PointsConfigRecord,
  ProductTypeInput,
  ProductTypeRecord,
  UploadToolImageResult,
  UserRecord,
  UserUpdateInput,
} from '../types/admin';

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
}
