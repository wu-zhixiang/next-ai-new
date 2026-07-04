"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWechatPayV3Config = getWechatPayV3Config;
exports.hasWechatPayV3Config = hasWechatPayV3Config;
exports.getWechatPayPublicKeySerial = getWechatPayPublicKeySerial;
exports.encryptWechatPaySensitiveField = encryptWechatPaySensitiveField;
exports.verifyWechatPayV3Signature = verifyWechatPayV3Signature;
exports.decryptWechatPayResource = decryptWechatPayResource;
exports.requestWechatPayV3 = requestWechatPayV3;
exports.downloadWechatPayFile = downloadWechatPayFile;
exports.getWechatPayHeader = getWechatPayHeader;
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
function getWechatPayV3Config() {
    const mchId = process.env.WECHAT_PAY_MCH_ID || process.env.WX_PAY_MCH_ID || '';
    const merchantSerialNo = process.env.WECHAT_PAY_MERCHANT_SERIAL_NO || '';
    const privateKey = normalizePrivateKey(process.env.WECHAT_PAY_PRIVATE_KEY || '');
    const publicKeyId = process.env.WECHAT_PAY_PUBLIC_KEY_ID || '';
    const publicKey = normalizePublicKey(process.env.WECHAT_PAY_PUBLIC_KEY || '');
    const missing = [
        !mchId && 'WECHAT_PAY_MCH_ID',
        !merchantSerialNo && 'WECHAT_PAY_MERCHANT_SERIAL_NO',
        !privateKey && 'WECHAT_PAY_PRIVATE_KEY',
    ].filter(Boolean);
    if (missing.length > 0) {
        throw new Error(`缺少微信支付 API v3 配置：${missing.join(', ')}`);
    }
    assertPemKey('WECHAT_PAY_PRIVATE_KEY', privateKey, ['PRIVATE KEY', 'RSA PRIVATE KEY']);
    if (publicKey) {
        assertPemKey('WECHAT_PAY_PUBLIC_KEY', publicKey, ['PUBLIC KEY']);
    }
    return { mchId, merchantSerialNo, privateKey, publicKeyId, publicKey };
}
function hasWechatPayV3Config() {
    try {
        getWechatPayV3Config();
        return true;
    }
    catch (_a) {
        return false;
    }
}
function getWechatPayPublicKeySerial(config) {
    if (!config.publicKey || !config.publicKeyId) {
        throw new Error('缺少微信支付公钥配置：WECHAT_PAY_PUBLIC_KEY_ID / WECHAT_PAY_PUBLIC_KEY');
    }
    return config.publicKeyId;
}
function encryptWechatPaySensitiveField(value, config) {
    if (!value) {
        return '';
    }
    if (!config.publicKey) {
        throw new Error('缺少微信支付公钥配置：WECHAT_PAY_PUBLIC_KEY');
    }
    return crypto_1.default.publicEncrypt({
        key: config.publicKey,
        padding: crypto_1.default.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
    }, Buffer.from(value, 'utf8')).toString('base64');
}
function verifyWechatPayV3Signature(params) {
    if (!params.config.publicKey || params.serial !== params.config.publicKeyId) {
        return false;
    }
    if (params.signature.startsWith('WECHATPAY/SIGNTEST/')) {
        return false;
    }
    const message = `${params.timestamp}\n${params.nonce}\n${params.body}\n`;
    return crypto_1.default
        .createVerify('RSA-SHA256')
        .update(message, 'utf8')
        .verify(params.config.publicKey, params.signature, 'base64');
}
function decryptWechatPayResource(resource, apiV3Key = process.env.WECHAT_PAY_API_V3_KEY || '') {
    if (resource.algorithm !== 'AEAD_AES_256_GCM') {
        throw new Error('不支持的微信支付回调加密算法');
    }
    if (!apiV3Key) {
        throw new Error('缺少微信支付 API v3 密钥：WECHAT_PAY_API_V3_KEY');
    }
    if (Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
        throw new Error('微信支付 API v3 密钥长度必须为 32 字节');
    }
    if (!resource.ciphertext || !resource.nonce) {
        throw new Error('微信支付回调密文参数不完整');
    }
    const ciphertext = Buffer.from(resource.ciphertext, 'base64');
    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(resource.nonce, 'utf8'));
    if (resource.associated_data) {
        decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
    }
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
}
async function requestWechatPayV3(config, options) {
    var _a;
    const body = options.body === undefined ? '' : JSON.stringify(options.body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto_1.default.randomBytes(16).toString('hex');
    const signature = signWechatPayV3({
        method: options.method,
        path: options.path,
        timestamp,
        nonce,
        body,
        privateKey: config.privateKey,
    });
    const authorization = `WECHATPAY2-SHA256-RSA2048 ${[
        `mchid="${config.mchId}"`,
        `nonce_str="${nonce}"`,
        `signature="${signature}"`,
        `timestamp="${timestamp}"`,
        `serial_no="${config.merchantSerialNo}"`,
    ].join(',')}`;
    return requestJson({
        method: options.method,
        hostname: 'api.mch.weixin.qq.com',
        path: options.path,
        body,
        headers: {
            Authorization: authorization,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'gpt-pay-miniapp/1.0 WeChatPay-APIv3',
            ...((_a = options.headers) !== null && _a !== void 0 ? _a : {}),
        },
    });
}
function downloadWechatPayFile(url) {
    return new Promise((resolve, reject) => {
        const parsed = new url_1.URL(url);
        https_1.default.get(parsed, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => {
                var _a, _b;
                const content = Buffer.concat(chunks);
                const contentType = String((_a = response.headers['content-type']) !== null && _a !== void 0 ? _a : '');
                if (((_b = response.statusCode) !== null && _b !== void 0 ? _b : 0) >= 400 || contentType.includes('application/json')) {
                    reject(new Error(content.toString('utf8') || `下载发票文件失败：${response.statusCode}`));
                    return;
                }
                resolve({ content, headers: response.headers });
            });
        }).on('error', reject);
    });
}
function signWechatPayV3(params) {
    const message = `${params.method}\n${params.path}\n${params.timestamp}\n${params.nonce}\n${params.body}\n`;
    return crypto_1.default
        .createSign('RSA-SHA256')
        .update(message, 'utf8')
        .sign(params.privateKey, 'base64');
}
function requestJson(options) {
    return new Promise((resolve, reject) => {
        const request = https_1.default.request({
            hostname: options.hostname,
            path: options.path,
            method: options.method,
            headers: {
                ...options.headers,
                'Content-Length': Buffer.byteLength(options.body),
            },
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => {
                var _a;
                const rawBody = Buffer.concat(chunks).toString('utf8');
                let data = null;
                if (rawBody) {
                    try {
                        data = JSON.parse(rawBody);
                    }
                    catch (_b) {
                        data = null;
                    }
                }
                resolve({
                    statusCode: (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0,
                    headers: response.headers,
                    data,
                    rawBody,
                });
            });
        });
        request.on('error', reject);
        request.write(options.body);
        request.end();
    });
}
function getWechatPayHeader(headers, name) {
    var _a, _b;
    const target = name.toLowerCase();
    return (_b = (_a = Object.entries(headers !== null && headers !== void 0 ? headers : {}).find(([key]) => key.toLowerCase() === target)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : '';
}
function normalizePrivateKey(value) {
    const trimmed = trimEnvValue(value);
    return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}
function normalizePublicKey(value) {
    const trimmed = trimEnvValue(value);
    return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}
function trimEnvValue(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}
function assertPemKey(envName, value, allowedLabels) {
    const startsWithAllowedLabel = allowedLabels.some((label) => value.startsWith(`-----BEGIN ${label}-----`));
    const endsWithAllowedLabel = allowedLabels.some((label) => value.endsWith(`-----END ${label}-----`));
    if (!startsWithAllowedLabel || !endsWithAllowedLabel) {
        throw new Error(`${envName} 格式错误：请填写 PEM 内容本身，不要填写文件路径；首尾应包含 ${allowedLabels.map((label) => `-----BEGIN ${label}-----`).join(' 或 ')}`);
    }
}
