import { DEFAULT_PRODUCT_CODE } from './constants';
import { collection, ensureCollection } from './db';
import type { ProductTypeRecord } from './types';

const CHATGPT_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/chatgpt_avatar_handdrawn_200x200.png?sign=a90045835786ba674c878e1fe4b1ad77&t=1781704918';
const CLAUDE_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/claude_avatar_200x200_no_white.png?sign=0cfe12826649cd2d1b410eb1a2d71487&t=1781705092';

export const PRODUCT_TYPE_SEED: ProductTypeRecord[] = [
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: 'ChatGPT',
    label: 'ChatGPT',
    tag: '稳定性',
    avatarUrl: CHATGPT_AVATAR_URL,
    available: true,
    description: '提供 Go、Plus、Pro 5x 等套餐，适合日常使用与重度 AI 用户。',
    introHighlights: [
      { title: 'ChatGPT 权益', description: '提供 Go、Plus、Pro 5x 等不同档位。' },
      { title: '会员服务', description: '开通后进入人工处理流程，完成后展示会员有效期。' },
      { title: '当前状态', description: '支持购买' },
    ],
    complianceDisplay: {
      productName: 'AI效率会员',
      label: 'AI效率会员',
      tag: '效率提升',
      description: '适合日常办公、学习研究与效率提升等使用场景。',
      introHighlights: [
        { title: '效率服务', description: '适合办公处理、学习研究与开发辅助场景。' },
        { title: '会员服务', description: '开通后进入人工处理流程，完成后展示会员有效期。' },
        { title: '当前状态', description: '支持购买' },
      ],
    },
    sort: 1,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    productCode: 'claude_pro',
    productName: 'Claude',
    label: 'Claude',
    tag: '性价比',
    avatarUrl: CLAUDE_AVATAR_URL,
    available: true,
    description: '提供 Claude Pro、Claude Max 5x 套餐，可使用同一账号登录 Claude Code。',
    introHighlights: [
      { title: 'Claude 权益', description: '提供 Claude Pro、Claude Max 5x 等不同档位。' },
      { title: 'Claude Code', description: '使用同一个 Claude 账号登录 Claude Code。' },
      { title: '当前状态', description: '支持选择' },
    ],
    complianceDisplay: {
      productName: 'AI创作会员',
      label: 'AI创作会员',
      tag: '内容创作',
      description: '适合内容创作、办公处理与开发辅助等使用场景。',
      introHighlights: [
        { title: '创作服务', description: '适合内容创作、运营与开发辅助场景。' },
        { title: '独立套餐', description: '提供独立套餐、订单和交付流程。' },
        { title: '当前状态', description: '支持选择' },
      ],
    },
    sort: 2,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
];

export async function seedProductTypes(now = Date.now()): Promise<number> {
  await ensureCollection('productTypes');

  for (const seed of PRODUCT_TYPE_SEED) {
    const existing = await collection('productTypes').where({ productCode: seed.productCode }).limit(1).get();
    const current = existing.data[0] as (ProductTypeRecord & { _id: string }) | undefined;
    if (current?._id) {
      await collection('productTypes').doc(current._id).update({
        data: {
          ...seed,
          updatedAt: now,
        },
      });
      continue;
    }

    await collection('productTypes').add({
      data: {
        ...seed,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return PRODUCT_TYPE_SEED.length;
}

export async function seedProductTypeComplianceDisplays(now = Date.now()): Promise<number> {
  await ensureCollection('productTypes');
  let updated = 0;
  for (const seed of PRODUCT_TYPE_SEED) {
    const existing = await collection('productTypes').where({ productCode: seed.productCode }).limit(1).get();
    const current = existing.data[0] as (ProductTypeRecord & { _id: string }) | undefined;
    if (!current?._id || !seed.complianceDisplay) continue;
    await collection('productTypes').doc(current._id).update({
      data: {
        complianceDisplay: seed.complianceDisplay,
        updatedAt: now,
      },
    });
    updated += 1;
  }
  return updated;
}
