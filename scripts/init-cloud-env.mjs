import { execFileSync } from 'node:child_process';

const appid = 'wx1bbde9dcd7559d54';
const envId = 'cloud1-d3gbrpive8611514c';
const projectPath = process.cwd();
const privateKeyPath = '/Users/qitmac001343/.codex/private.wx1bbde9dcd7559d54.key';

const collections = [
  'users',
  'member_plans',
  'memberships',
  'orders',
  'deliveries',
  'renew_contracts',
  'reminder_logs',
  'audit_logs',
];

const plans = [
  {
    productCode: 'openai_plus',
    productName: 'AI 会员',
    planCode: 'annual',
    planName: '年度会员',
    price: 0.01,
    durationDays: 365,
    autoRenewEnabled: false,
    status: 'on',
    sort: 1,
    description: '年度主力套餐，适合长期使用场景。',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productCode: 'openai_plus',
    productName: 'AI 会员',
    planCode: 'quarterly',
    planName: '季度会员',
    price: 0.01,
    durationDays: 90,
    autoRenewEnabled: false,
    status: 'on',
    sort: 2,
    description: '季度会员套餐，适合阶段性体验。',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    productCode: 'openai_plus',
    productName: 'AI 会员',
    planCode: 'monthly',
    planName: '月度会员',
    price: 0.01,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 3,
    description: '月度短周期套餐，适合低门槛试用。',
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
