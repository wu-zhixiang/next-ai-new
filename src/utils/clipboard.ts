export type ClipboardLabel = '账号' | '密码' | '验证码';

export function maskSecret(value: string): string {
  return '*'.repeat(Array.from(value).length);
}

interface ClipboardActions {
  setClipboardData: (value: string) => Promise<void>;
  hideToast: () => Promise<void>;
  showToast: (title: string) => Promise<void>;
}

async function showToastSafely(title: string, actions: ClipboardActions): Promise<void> {
  try {
    await actions.showToast(title);
  } catch {
    // Toast 展示失败不影响复制结果。
  }
}

export async function copyWithToast(
  value: string,
  label: ClipboardLabel,
  actions: ClipboardActions,
): Promise<boolean> {
  try {
    await actions.setClipboardData(value);
  } catch {
    await showToastSafely('复制失败，请重试', actions);
    return false;
  }

  try {
    await actions.hideToast();
  } catch {
    // 部分运行环境没有可关闭的系统 Toast，忽略即可。
  }

  await showToastSafely(`${label}已复制`, actions);
  return true;
}
