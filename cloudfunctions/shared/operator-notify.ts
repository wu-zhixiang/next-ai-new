import http from 'node:http';
import https from 'node:https';
import { collection, getUserById } from './db';
import type { OrderRecord, UserRecord } from './types';

interface NotifyPayload {
  title: string;
  text: string;
  markdown: string;
}

interface HttpResponse {
  statusCode: number;
  body: string;
}

function maskMobile(mobile?: string): string {
  if (!mobile) {
    return '未绑定';
  }
  return mobile.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function formatCSTTime(value?: number): string {
  if (!value) {
    return '未知';
  }
  const date = new Date(value + 8 * 60 * 60 * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function buildNotifyPayload(order: OrderRecord & { _id: string }, user: (UserRecord & { _id: string }) | null): NotifyPayload {
  const paidAt = order.paidAt ?? Date.now();
  const accountEmail = user?.aiAccountEmail || '未填写';
  const lines = [
    '有新会员订单已支付，等待人工开通。',
    '',
    `订单号：${order.orderNo}`,
    `产品：${order.productName}`,
    `套餐：${order.planName}`,
    `实付金额：¥${order.amount.toFixed(2)}`,
    `支付时间：${formatCSTTime(paidAt)}`,
    `用户手机号：${maskMobile(user?.mobile)}`,
    `注册账号：${accountEmail}`,
    '',
    '密码请在运营插件中查看，不通过通知发送明文密码。',
  ];
  const markdownLines = [
    `### ${lines[0]}`,
    '',
    `>订单号：${order.orderNo}`,
    `>产品：${order.productName}`,
    `>套餐：${order.planName}`,
    `>实付金额：¥${order.amount.toFixed(2)}`,
    `>支付时间：${formatCSTTime(paidAt)}`,
    `>用户手机号：${maskMobile(user?.mobile)}`,
    `>注册账号：${accountEmail}`,
    '',
    '请打开运营插件查看密码并完成开通。',
  ];

  return {
    title: '新会员订单待开通',
    text: lines.join('\n'),
    markdown: markdownLines.join('\n'),
  };
}

function postJson(url: string, payload: unknown): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const client = target.protocol === 'http:' ? http : https;
    const request = client.request(
      {
        method: 'POST',
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 8000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('operator notify request timeout'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function sendWeworkWebhook(webhookUrl: string, payload: NotifyPayload): Promise<void> {
  const response = await postJson(webhookUrl, {
    msgtype: 'markdown',
    markdown: {
      content: payload.markdown,
    },
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`企业微信机器人通知失败：HTTP ${response.statusCode}`);
  }
}

async function sendPushPlus(token: string, payload: NotifyPayload): Promise<void> {
  const response = await postJson('https://www.pushplus.plus/send', {
    token,
    title: payload.title,
    content: payload.text.replace(/\n/g, '<br>'),
    template: 'html',
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`PushPlus 通知失败：HTTP ${response.statusCode}`);
  }
}

async function sendServerChan(sendKey: string, payload: NotifyPayload): Promise<void> {
  const response = await postJson(`https://sctapi.ftqq.com/${encodeURIComponent(sendKey)}.send`, {
    title: payload.title,
    desp: payload.markdown,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Server酱通知失败：HTTP ${response.statusCode}`);
  }
}

function getConfiguredChannels(): string[] {
  const channels: string[] = [];
  if (process.env.WEWORK_BOT_WEBHOOK) {
    channels.push('wework');
  }
  if (process.env.PUSHPLUS_TOKEN) {
    channels.push('pushplus');
  }
  if (process.env.SERVERCHAN_SENDKEY) {
    channels.push('serverchan');
  }
  return channels;
}

export async function notifyOperatorPaidOrderOnce(order: OrderRecord & { _id: string }): Promise<void> {
  if (process.env.OPERATOR_NOTIFY_ENABLED === '0') {
    return;
  }
  if (order.operatorNotifiedAt) {
    return;
  }

  const channels = getConfiguredChannels();
  if (channels.length === 0) {
    console.info(JSON.stringify({ tag: 'operator.notify.skipped', reason: 'not_configured', orderNo: order.orderNo }));
    return;
  }

  const user = await getUserById(order.userId);
  const payload = buildNotifyPayload(order, user);
  const sentChannels: string[] = [];
  const errors: string[] = [];

  for (const channel of channels) {
    try {
      if (channel === 'wework') {
        await sendWeworkWebhook(process.env.WEWORK_BOT_WEBHOOK as string, payload);
      } else if (channel === 'pushplus') {
        await sendPushPlus(process.env.PUSHPLUS_TOKEN as string, payload);
      } else if (channel === 'serverchan') {
        await sendServerChan(process.env.SERVERCHAN_SENDKEY as string, payload);
      }
      sentChannels.push(channel);
    } catch (error) {
      errors.push(`${channel}:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (sentChannels.length === 0) {
    console.error(JSON.stringify({ tag: 'operator.notify.failed', orderNo: order.orderNo, errors }));
    return;
  }

  const notifiedAt = Date.now();
  await collection('orders').doc(order._id).update({
    data: {
      operatorNotifiedAt: notifiedAt,
      operatorNotifyChannel: sentChannels.join(','),
      updatedAt: notifiedAt,
    },
  });

  console.info(JSON.stringify({ tag: 'operator.notify.sent', orderNo: order.orderNo, channels: sentChannels, errors }));
}
