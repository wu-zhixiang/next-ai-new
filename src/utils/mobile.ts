export function isMobileBound(mobile?: string): boolean {
  return Boolean(mobile);
}

export function maskMobile(mobile?: string): string {
  if (!mobile) {
    return '';
  }

  const normalized = mobile.replace(/\s+/g, '');
  if (/^\d{11}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
  }

  return mobile;
}

export function formatMobileDisplay(mobile?: string): string {
  if (!mobile) {
    return '未绑定手机号';
  }

  return maskMobile(mobile);
}
