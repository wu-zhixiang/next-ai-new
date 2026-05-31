declare module 'wx-server-sdk' {
  interface QueryResult {
    data: unknown[];
  }

  interface Query {
    limit(count: number): {
      get(): Promise<QueryResult>;
    };
    get(): Promise<QueryResult>;
    orderBy(fieldName: string, order: 'asc' | 'desc'): {
      get(): Promise<QueryResult>;
    };
  }

  interface CollectionRef {
    where(query: Record<string, unknown>): Query;
    doc(id: string): {
      get(): Promise<{ data: unknown }>;
      update(payload: { data: unknown }): Promise<unknown>;
    };
    add(payload: { data: unknown }): Promise<{ _id: string }>;
  }

  const cloud: {
    DYNAMIC_CURRENT_ENV: unknown;
    init(options?: { env?: unknown }): void;
    getWXContext(): {
      OPENID: string;
      APPID?: string;
      UNIONID?: string;
    };
    uploadFile(options: { cloudPath: string; fileContent: Buffer }): Promise<{ fileID: string }>;
    database(): {
      command: unknown;
      createCollection(name: string): Promise<unknown>;
      collection(name: string): CollectionRef;
    };
  };

  export default cloud;
}
