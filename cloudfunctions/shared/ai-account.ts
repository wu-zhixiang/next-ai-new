import crypto from 'crypto';

function getAiAccountKey(): Buffer {
  const secret = process.env.AI_ACCOUNT_SECRET || 'gpt-pay-default-ai-account-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptAiAccountPassword(password: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAiAccountKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptAiAccountPassword(payload: string): string {
  const [ivBase64, tagBase64, encryptedBase64] = payload.split('.');
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error('AI账号密码数据格式异常');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getAiAccountKey(), Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
