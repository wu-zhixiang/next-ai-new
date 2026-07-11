export interface ApiEnvelope<T> {
  readonly code: number;
  readonly message: string;
  readonly data: T;
}

export interface HttpClientConfig {
  readonly baseUrl: string;
  readonly token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    isRecord(value)
    && typeof value.code === 'number'
    && typeof value.message === 'string'
    && 'data' in value
  );
}

function normalizeBaseUrl(value: string): string {
  if (import.meta.env.DEV) {
    return '/admin-api';
  }
  return value.replace(/\/$/, '');
}

export class HttpClient {
  private readonly baseUrl: string;

  private readonly token: string;

  constructor(config: HttpClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.token = config.token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('缺少后台 API 地址');
    }

    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    headers.set('authorization', `Bearer ${this.token}`);

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = isApiEnvelope(payload) ? payload.message : `HTTP ${response.status}`;
      throw new Error(message);
    }

    if (!isApiEnvelope(payload)) {
      throw new Error('后台接口返回格式不正确');
    }

    if (payload.code !== 0) {
      throw new Error(payload.message);
    }

    return payload.data as T;
  }
}
