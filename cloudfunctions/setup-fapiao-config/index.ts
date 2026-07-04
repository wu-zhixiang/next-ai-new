import { ok } from '../shared/utils';
import { getWechatPayV3Config, requestWechatPayV3 } from '../shared/wechat-pay-v3';

interface Event {
  token?: unknown;
  operatorToken?: unknown;
}

interface DevelopmentConfigResponse {
  callback_url: string;
  show_fapiao_cell?: boolean;
}

interface CardTemplateResponse {
  card_appid: string;
  card_id: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function errorResponse(message: string, includeDiagnostics = false) {
  return {
    code: 400,
    message,
    data: includeDiagnostics
      ? {
          diagnostics: buildDiagnostics(),
        }
      : null,
  };
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function getRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    fail(`缺少电子发票初始化配置：${name}`);
  }
  return value;
}

function getOptionalBooleanEnv(name: string): boolean | undefined {
  const value = readEnv(name).toLowerCase();
  if (!value) {
    return undefined;
  }
  if (['true', '1', 'yes', 'on'].includes(value)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(value)) {
    return false;
  }
  fail(`电子发票初始化配置格式错误：${name}`);
}

function assertSetupToken(event: Event): void {
  const expected = readEnv('WECHAT_FAPIAO_SETUP_TOKEN') || readEnv('OPERATOR_API_TOKEN');
  if (!expected) {
    fail('缺少电子发票初始化密钥：WECHAT_FAPIAO_SETUP_TOKEN');
  }
  const provided = typeof event.token === 'string'
    ? event.token.trim()
    : typeof event.operatorToken === 'string'
      ? event.operatorToken.trim()
      : '';
  if (provided !== expected) {
    fail('电子发票初始化密钥不正确');
  }
}

function buildCardTemplatePayload() {
  const cardAppid = getRequiredEnv('WECHAT_FAPIAO_CARD_APPID');
  const logoUrl = getRequiredEnv('WECHAT_FAPIAO_CARD_LOGO_URL');
  const payeeName = readEnv('WECHAT_FAPIAO_CARD_PAYEE_NAME');
  const words = readEnv('WECHAT_FAPIAO_CARD_CELL_WORDS');
  const description = readEnv('WECHAT_FAPIAO_CARD_CELL_DESCRIPTION');
  const jumpUrl = readEnv('WECHAT_FAPIAO_CARD_CELL_JUMP_URL');
  const miniprogramUserName = readEnv('WECHAT_FAPIAO_CARD_CELL_MINIPROGRAM_USER_NAME');
  const miniprogramPath = readEnv('WECHAT_FAPIAO_CARD_CELL_MINIPROGRAM_PATH');
  const hasCustomCell = Boolean(words || description || jumpUrl || miniprogramUserName || miniprogramPath);

  if (hasCustomCell && (!words || !description)) {
    fail('配置卡券 custom_cell 时，WECHAT_FAPIAO_CARD_CELL_WORDS 和 WECHAT_FAPIAO_CARD_CELL_DESCRIPTION 必填');
  }

  return {
    card_appid: cardAppid,
    card_template_information: {
      payee_name: payeeName || undefined,
      logo_url: logoUrl,
      custom_cell: hasCustomCell
        ? {
            words,
            description,
            jump_url: jumpUrl || undefined,
            miniprogram_user_name: miniprogramUserName || undefined,
            miniprogram_path: miniprogramPath || undefined,
          }
        : undefined,
    },
  };
}

function buildDevelopmentConfigPayload() {
  const callbackUrl = getRequiredEnv('WECHAT_FAPIAO_CALLBACK_URL');
  const showFapiaoCell = getOptionalBooleanEnv('WECHAT_FAPIAO_SHOW_CELL');
  return {
    callback_url: callbackUrl,
    show_fapiao_cell: showFapiaoCell ?? false,
  };
}

function shouldSetupCardTemplate(): boolean {
  return getOptionalBooleanEnv('WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE') ?? false;
}

function maskTail(value: string, length: number): string {
  if (!value) {
    return '';
  }
  return value.length <= length ? value : `***${value.slice(-length)}`;
}

function buildDiagnostics() {
  return {
    mchIdSource: readEnv('WECHAT_PAY_MCH_ID') ? 'WECHAT_PAY_MCH_ID' : readEnv('WX_PAY_MCH_ID') ? 'WX_PAY_MCH_ID' : 'missing',
    mchIdTail: maskTail(readEnv('WECHAT_PAY_MCH_ID') || readEnv('WX_PAY_MCH_ID'), 4),
    merchantSerialNoTail: maskTail(readEnv('WECHAT_PAY_MERCHANT_SERIAL_NO'), 8),
    hasPrivateKey: Boolean(readEnv('WECHAT_PAY_PRIVATE_KEY')),
    hasApiV3Key: Boolean(readEnv('WECHAT_PAY_API_V3_KEY')),
    enableCardTemplate: getOptionalBooleanEnv('WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE') ?? false,
  };
}

function getWechatPayErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const record = data as { code?: unknown; message?: unknown };
    if (typeof record.message === 'string' && record.message) {
      return record.code ? `${record.code}: ${record.message}` : record.message;
    }
  }
  return fallback;
}

export async function main(event: Event = {}) {
  let tokenVerified = false;
  try {
    assertSetupToken(event);
    tokenVerified = true;
    const config = getWechatPayV3Config();
    const enableCardTemplate = shouldSetupCardTemplate();

    const developmentResponse = await requestWechatPayV3<DevelopmentConfigResponse>(config, {
      method: 'PATCH',
      path: '/v3/new-tax-control-fapiao/merchant/development-config',
      body: buildDevelopmentConfigPayload(),
    });
    if (developmentResponse.statusCode !== 200 || !developmentResponse.data) {
      fail(getWechatPayErrorMessage(developmentResponse.data, developmentResponse.rawBody || '配置电子发票开发选项失败'));
    }

    let cardTemplate: CardTemplateResponse | null = null;
    if (enableCardTemplate) {
      const cardResponse = await requestWechatPayV3<CardTemplateResponse>(config, {
        method: 'POST',
        path: '/v3/new-tax-control-fapiao/card-template',
        body: buildCardTemplatePayload(),
      });
      if (cardResponse.statusCode !== 200 || !cardResponse.data) {
        fail(getWechatPayErrorMessage(cardResponse.data, cardResponse.rawBody || '创建电子发票卡券模板失败'));
      }
      cardTemplate = cardResponse.data;
    }

    return ok({
      developmentConfig: developmentResponse.data,
      cardTemplate,
      cardTemplateSkipped: !enableCardTemplate,
      diagnostics: buildDiagnostics(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '初始化电子发票配置失败', tokenVerified);
  }
}
