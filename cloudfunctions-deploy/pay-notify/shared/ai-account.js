"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptAiAccountPassword = encryptAiAccountPassword;
exports.decryptAiAccountPassword = decryptAiAccountPassword;
const crypto_1 = __importDefault(require("crypto"));
function getAiAccountKey() {
    const secret = process.env.AI_ACCOUNT_SECRET || 'gpt-pay-default-ai-account-secret';
    return crypto_1.default.createHash('sha256').update(secret).digest();
}
function encryptAiAccountPassword(password) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', getAiAccountKey(), iv);
    const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}
function decryptAiAccountPassword(payload) {
    const [ivBase64, tagBase64, encryptedBase64] = payload.split('.');
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
        throw new Error('AI账号密码数据格式异常');
    }
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', getAiAccountKey(), Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedBase64, 'base64')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}
