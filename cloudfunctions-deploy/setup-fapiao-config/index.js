"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const utils_1 = require("./shared/utils");
const wechat_pay_v3_1 = require("./shared/wechat-pay-v3");
function fail(message) {
    throw new Error(message);
}
function errorResponse(message, includeDiagnostics = false) {
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
function readEnv(name) {
    var _a, _b;
    return (_b = (_a = process.env[name]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
}
function getRequiredEnv(name) {
    const value = readEnv(name);
    if (!value) {
        fail(`缺少电子发票初始化配置：${name}`);
    }
    return value;
}
function getOptionalBooleanEnv(name) {
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
function assertSetupToken(event) {
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
        show_fapiao_cell: showFapiaoCell !== null && showFapiaoCell !== void 0 ? showFapiaoCell : false,
    };
}
function shouldSetupCardTemplate() {
    var _a;
    return (_a = getOptionalBooleanEnv('WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE')) !== null && _a !== void 0 ? _a : false;
}
function maskTail(value, length) {
    if (!value) {
        return '';
    }
    return value.length <= length ? value : `***${value.slice(-length)}`;
}
function buildDiagnostics() {
    var _a;
    return {
        mchIdSource: readEnv('WECHAT_PAY_MCH_ID') ? 'WECHAT_PAY_MCH_ID' : readEnv('WX_PAY_MCH_ID') ? 'WX_PAY_MCH_ID' : 'missing',
        mchIdTail: maskTail(readEnv('WECHAT_PAY_MCH_ID') || readEnv('WX_PAY_MCH_ID'), 4),
        merchantSerialNoTail: maskTail(readEnv('WECHAT_PAY_MERCHANT_SERIAL_NO'), 8),
        hasPrivateKey: Boolean(readEnv('WECHAT_PAY_PRIVATE_KEY')),
        hasApiV3Key: Boolean(readEnv('WECHAT_PAY_API_V3_KEY')),
        enableCardTemplate: (_a = getOptionalBooleanEnv('WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE')) !== null && _a !== void 0 ? _a : false,
    };
}
function getWechatPayErrorMessage(data, fallback) {
    if (data && typeof data === 'object') {
        const record = data;
        if (typeof record.message === 'string' && record.message) {
            return record.code ? `${record.code}: ${record.message}` : record.message;
        }
    }
    return fallback;
}
async function main(event = {}) {
    let tokenVerified = false;
    try {
        assertSetupToken(event);
        tokenVerified = true;
        const config = (0, wechat_pay_v3_1.getWechatPayV3Config)();
        const enableCardTemplate = shouldSetupCardTemplate();
        const developmentResponse = await (0, wechat_pay_v3_1.requestWechatPayV3)(config, {
            method: 'PATCH',
            path: '/v3/new-tax-control-fapiao/merchant/development-config',
            body: buildDevelopmentConfigPayload(),
        });
        if (developmentResponse.statusCode !== 200 || !developmentResponse.data) {
            fail(getWechatPayErrorMessage(developmentResponse.data, developmentResponse.rawBody || '配置电子发票开发选项失败'));
        }
        let cardTemplate = null;
        if (enableCardTemplate) {
            const cardResponse = await (0, wechat_pay_v3_1.requestWechatPayV3)(config, {
                method: 'POST',
                path: '/v3/new-tax-control-fapiao/card-template',
                body: buildCardTemplatePayload(),
            });
            if (cardResponse.statusCode !== 200 || !cardResponse.data) {
                fail(getWechatPayErrorMessage(cardResponse.data, cardResponse.rawBody || '创建电子发票卡券模板失败'));
            }
            cardTemplate = cardResponse.data;
        }
        return (0, utils_1.ok)({
            developmentConfig: developmentResponse.data,
            cardTemplate,
            cardTemplateSkipped: !enableCardTemplate,
            diagnostics: buildDiagnostics(),
        });
    }
    catch (error) {
        return errorResponse(error instanceof Error ? error.message : '初始化电子发票配置失败', tokenVerified);
    }
}
