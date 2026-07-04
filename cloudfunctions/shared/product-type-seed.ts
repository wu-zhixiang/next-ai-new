import { DEFAULT_PRODUCT_CODE } from './constants';
import { collection, ensureCollection } from './db';
import type { ProductTypeRecord } from './types';

const CHATGPT_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/chatgpt_avatar_handdrawn_200x200.png?sign=a90045835786ba674c878e1fe4b1ad77&t=1781704918';
const QUOTA_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/token_robot_avatar_200x200.png?sign=3a66c648d938e68c765b484433b496f2&t=1783048076';
const CLAUDE_AVATAR_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/images/claude_avatar_200x200_no_white.png?sign=0cfe12826649cd2d1b410eb1a2d71487&t=1781705092';

export const PRODUCT_TYPE_SEED: ProductTypeRecord[] = [
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: 'Chatgpt',
    label: 'Chatgpt',
    tag: 'ChatGPT + Codex',
    avatarUrl: CHATGPT_AVATAR_URL,
    detailPageUrl: 'pages/news-detail/index?id=516f04746a473228001c688068c819b7',
    available: true,
    description: '提供 ChatGPT、Codex 和图片生成相关套餐，适合办公、内容创作和开发场景。',
    introHighlights: [
      { title: 'ChatGPT 与 Codex', description: 'Chatgpt 标准版和 Chatgpt 专业版支持 ChatGPT 与 Codex，Codex 套餐聚焦代码任务。' },
      { title: '图片能力', description: 'Chatgpt 标准版和 Chatgpt 专业版支持生图、图片理解、图片改图和图生图。' },
      { title: '会员服务', description: '开通后进入人工处理流程，完成后展示会员有效期。' },
    ],
    complianceDisplay: {
      productName: 'AI效率会员',
      label: 'AI效率会员',
      tag: '效率提升',
      description: '适合日常办公、内容创作、开发辅助与效率提升等使用场景。',
      introHighlights: [
        { title: '效率服务', description: '适合办公处理、内容创作、学习研究与开发辅助场景。' },
        { title: '会员服务', description: '开通后进入人工处理流程，完成后展示会员有效期。' },
      ],
    },
    sort: 1,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    productCode: 'quota_points',
    productName: '额度包',
    label: '额度包',
    tag: '额度补充',
    avatarUrl: QUOTA_AVATAR_URL,
    detailPageUrl: 'pages/news-detail/index?id=e1a876e86a47362d000e27b855d8b1ed',
    available: true,
    description: '用于补充高级能力和高成本任务额度，适合 Codex、图片生成、长上下文和复杂任务。',
    introHighlights: [
      { title: '额度补充', description: '提供 40、80、160 元额度包，适合不同强度的临时补充。' },
      { title: '适用任务', description: '适用于 Codex 编程任务、图片生成、长上下文、多文件修改等高成本能力。' },
      { title: '购买方式', description: '选择额度包后进入支付流程，完成后进入人工处理流程。' },
    ],
    complianceDisplay: {
      productName: 'AI额度包',
      label: 'AI额度包',
      tag: '额度补充',
      description: '用于补充复杂任务和高成本能力额度。',
      introHighlights: [
        { title: '额度补充', description: '适合临时补充和中高强度使用。' },
        { title: '适用任务', description: '适合代码任务、图片任务和长上下文任务。' },
        { title: '购买方式', description: '选择额度包后进入支付流程。' },
      ],
    },
    sort: 2,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    productCode: 'claude_pro',
    productName: 'Claude',
    label: 'Claude',
    tag: '暂未开放',
    avatarUrl: CLAUDE_AVATAR_URL,
    available: false,
    description: 'Claude 套餐暂未开放。',
    introHighlights: [
      { title: '当前状态', description: '暂未开放' },
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
    sort: 3,
    status: 'off',
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
