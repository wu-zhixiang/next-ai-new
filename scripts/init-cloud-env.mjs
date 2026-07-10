import { execFileSync } from 'node:child_process';

const appid = 'wx1bbde9dcd7559d54';
const envId = 'cloud1-d3gbrpive8611514c';
const projectPath = process.cwd();
const privateKeyPath = '/Users/qitmac001343/.codex/private.wx1bbde9dcd7559d54.key';

const collections = [
  'users',
  'member_plans',
  'product_types',
  'appstore_countries',
  'memberships',
  'orders',
  'ai_tool_runs',
  'ai_tool_assets',
  'ai_tool_usage_daily',
  'ai_tool_templates',
  'deliveries',
  'renew_contracts',
  'reminder_logs',
  'audit_logs',
];

function generatePlanPid(productCode, planCode) {
  return `${productCode}_${planCode}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

const plans = [
  {
    productCode: 'ai_news',
    productName: 'ChatGPT Plus',
    pid: generatePlanPid('ai_news', 'plus'),
    planCode: 'plus',
    planName: 'ChatGPT Plus',
    virtualPaymentProductId: 'chatgpt_plus',
    price: 160,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 1,
    description: 'ChatGPT Plus 月度会员套餐。',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productCode: 'claude_pro',
    productName: 'Claude Pro',
    pid: generatePlanPid('claude_pro', 'pro'),
    planCode: 'pro',
    planName: 'Claude Pro',
    virtualPaymentProductId: 'claude_pro',
    price: 128,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 2,
    description: 'Claude Pro 月度会员套餐。',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

function run(command, args) {
  return execFileSync('npx', ['miniprogram-ci', ...command, '--pp', projectPath, '--appid', appid, '--pkp', privateKeyPath, '--env', envId, ...args], {
    stdio: 'inherit',
  });
}

for (const name of collections) {
  run(['cloud', 'database', 'collection', 'create'], ['--name', name]);
}

run(['cloud', 'database', 'collection', 'data', 'import'], [
  '--name',
  'member_plans',
  '--data',
  JSON.stringify(plans),
  '--merge',
  'true',
]);
