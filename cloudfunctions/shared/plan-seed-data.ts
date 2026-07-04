import type { MemberPlanRecord } from './types';

const SEED_TIME = 1746921600000;
const CHATGPT_PRODUCT_CODE = 'ai_news';
const QUOTA_PRODUCT_CODE = 'quota_points';

function generatePlanPid(productCode: string, planCode: string): string {
  return `${productCode}_${planCode}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

const PLAN_SEED_SOURCE: Array<Omit<MemberPlanRecord, 'pid' | 'createdAt' | 'updatedAt'>> = [
  {
    productCode: CHATGPT_PRODUCT_CODE,
    productName: 'Chatgpt',
    planCode: 'all_in_one',
    planName: 'Chatgpt 标准版',
    virtualPaymentProductId: 'aionhub_all_in_one',
    price: 199,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 4,
    description: '支持 ChatGPT、Codex、生图、图片理解、图片改图和图生图，适合产品、运营、UI、客服、普通开发和管理层。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'Chatgpt 标准版',
      description: '适合日常办公、内容创作、通用 AI 使用和轻中度代码任务。',
    },
  },
  {
    productCode: CHATGPT_PRODUCT_CODE,
    productName: 'Chatgpt',
    planCode: 'ultimate',
    planName: 'Chatgpt 专业版',
    virtualPaymentProductId: 'aionhub_ultimate',
    price: 899,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 5,
    description: '支持 ChatGPT、Codex、生图、图片理解、图片改图和图生图，适合高强度用户。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'Chatgpt 专业版',
      description: '适合高频 ChatGPT 对话、复杂代码任务、高级推理、Deep Research 和重度图片能力。',
    },
  },
  {
    productCode: CHATGPT_PRODUCT_CODE,
    productName: 'Chatgpt',
    planCode: 'codex_trial',
    planName: 'Codex 体验版',
    virtualPaymentProductId: 'aionhub_codex_trial',
    price: 40,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 1,
    description: '支持 Codex，也支持 ChatGPT 轻度使用；适合临时开发、体验用户、低频开发者，生图消耗额度点。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员体验套餐',
      description: '适合轻量代码解释、简单脚本、单文件修改、ChatGPT 轻度使用和轻量生图。',
    },
  },
  {
    productCode: CHATGPT_PRODUCT_CODE,
    productName: 'Chatgpt',
    planCode: 'codex_basic',
    planName: 'Codex 标准版',
    virtualPaymentProductId: 'aionhub_codex_basic',
    price: 160,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 2,
    description: '支持 Codex，也支持 ChatGPT 轻度使用；适合普通开发、中度 Codex 用户，生图消耗额度点。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'Codex 标准版',
      description: '适合日常 Bug 修复、接口代码、SQL、单元测试、中小规模代码修改和 ChatGPT 轻度使用。',
    },
  },
  {
    productCode: CHATGPT_PRODUCT_CODE,
    productName: 'Chatgpt',
    planCode: 'codex_pro',
    planName: 'Codex 专业版',
    virtualPaymentProductId: 'aionhub_codex_pro',
    price: 799,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 3,
    description: '支持 Codex，也支持 ChatGPT 轻度使用；适合重度开发、核心研发、架构师和复杂代码任务。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员专业套餐',
      description: '适合项目级代码理解、多文件修改、复杂功能开发、代码重构、ChatGPT 轻度使用和中高频生图。',
    },
  },
  
  {
    productCode: QUOTA_PRODUCT_CODE,
    productName: '额度包',
    planCode: 'quota_40',
    planName: '40 ¥ 额度包',
    virtualPaymentProductId: 'aionhub_quota_40',
    price: 40,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 6,
    description: '额度点补充包，适合临时补充、小任务和轻量使用。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员小额补充包',
      description: '适合临时补充额度点和轻量高成本任务。',
    },
  },
  {
    productCode: QUOTA_PRODUCT_CODE,
    productName: '额度包',
    planCode: 'quota_80',
    planName: '80 ¥ 额度包',
    virtualPaymentProductId: 'aionhub_quota_80',
    price: 80,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 7,
    description: '额度点补充包，适合普通开发补充、月中加量和中等强度使用。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员标准补充包',
      description: '适合普通开发补充和中等强度高成本任务。',
    },
  },
  {
    productCode: QUOTA_PRODUCT_CODE,
    productName: '额度包',
    planCode: 'quota_160',
    planName: '160 ¥ 额度包',
    virtualPaymentProductId: 'aionhub_quota_160',
    price: 160,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 8,
    description: '额度点补充包，适合重度开发、核心项目和长期高频使用。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员高额补充包',
      description: '适合重度开发、核心项目和长期高频高成本任务。',
    },
  },
];

export const PLAN_SEED: MemberPlanRecord[] = PLAN_SEED_SOURCE.map((seed) => ({
  ...seed,
  pid: generatePlanPid(seed.productCode, seed.planCode),
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
}));
