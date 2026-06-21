export interface PrivacyCallbackResult {
  errMsg: string;
}

export interface PrivacyAuthorizeOptions {
  success?: (result: PrivacyCallbackResult) => void;
  fail?: (result: PrivacyCallbackResult) => void;
}

export interface PrivacyAuthorizeApi {
  requirePrivacyAuthorize?: (options: PrivacyAuthorizeOptions) => void;
}

export function requestPrivacyAuthorization(api: PrivacyAuthorizeApi): Promise<boolean> {
  if (typeof api.requirePrivacyAuthorize !== 'function') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    try {
      api.requirePrivacyAuthorize?.({
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    } catch {
      resolve(false);
    }
  });
}
