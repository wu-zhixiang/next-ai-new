import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'cloudfunctions');
const compileRoot = path.join('/private/tmp', 'gpt-pay-cloudfunctions-compiled');
const deployRoot = path.join(projectRoot, 'cloudfunctions-deploy');
const functionNames = [
  'bind-mobile',
  'cleanup-abandoned-orders',
  'clear-email-code',
  'create-order',
  'email-code-webhook',
  'fulfill-membership',
  'fapiao-notify',
  'get-ai-tool-run',
  'get-member-home',
  'get-ai-account',
  'get-ai-news-detail',
  'get-app-config',
  'get-fapiao-file',
  'get-invite-home',
  'get-latest-email-code',
  'get-pay-result',
  'get-profile',
  'list-ai-news',
  'list-invoice-orders',
  'list-orders',
  'list-member-plans',
  'list-appstore-countries',
  'list-product-types',
  'operator-api',
  'pay-notify',
  'pay-order',
  'reset-database',
  'retry-order',
  'run-ai-tool',
  'save-ai-account',
  'save-subscribe-auth',
  'setup-fapiao-config',
  'submit-invoice-request',
  'send-renew-reminders',
  'summarize-ai-tool',
  'seed-database',
  'user-login',
];

fs.rmSync(compileRoot, { recursive: true, force: true });
fs.rmSync(deployRoot, { recursive: true, force: true });
fs.mkdirSync(compileRoot, { recursive: true });
fs.mkdirSync(deployRoot, { recursive: true });

execFileSync(
  path.join(projectRoot, 'node_modules', '.bin', 'tsc'),
  [
    '--outDir',
    compileRoot,
    '--rootDir',
    sourceRoot,
    '--module',
    'commonjs',
    '--target',
    'ES2018',
    '--moduleResolution',
    'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--types',
    'node',
    path.join(sourceRoot, 'shared', 'wx-server-sdk.d.ts'),
    path.join(sourceRoot, '_lib', 'context.ts'),
    path.join(sourceRoot, 'shared', 'constants.ts'),
    path.join(sourceRoot, 'shared', 'ai-tool-core.ts'),
    path.join(sourceRoot, 'shared', 'ai-tool-generation.ts'),
    path.join(sourceRoot, 'shared', 'ai-tool-service.ts'),
    path.join(sourceRoot, 'shared', 'client-config.ts'),
    path.join(sourceRoot, 'shared', 'ai-account.ts'),
    path.join(sourceRoot, 'shared', 'ai-account-email-domain-core.ts'),
    path.join(sourceRoot, 'shared', 'ai-account-email-domain.ts'),
    path.join(sourceRoot, 'shared', 'ai-account-password.ts'),
    path.join(sourceRoot, 'shared', 'ai-news-sort.ts'),
    path.join(sourceRoot, 'shared', 'db.ts'),
    path.join(sourceRoot, 'shared', 'invite-reward-policy.ts'),
    path.join(sourceRoot, 'shared', 'operator-notify.ts'),
    path.join(sourceRoot, 'shared', 'orders.ts'),
    path.join(sourceRoot, 'shared', 'payment-config.ts'),
    path.join(sourceRoot, 'shared', 'plan-seed-data.ts'),
    path.join(sourceRoot, 'shared', 'plan-seed.ts'),
    path.join(sourceRoot, 'shared', 'appstore-country-data.ts'),
    path.join(sourceRoot, 'shared', 'appstore-country-seed.ts'),
    path.join(sourceRoot, 'shared', 'appstore-product-scope.ts'),
    path.join(sourceRoot, 'shared', 'product-type-seed.ts'),
    path.join(sourceRoot, 'shared', 'types.ts'),
    path.join(sourceRoot, 'shared', 'utils.ts'),
    path.join(sourceRoot, 'shared', 'wechat.ts'),
    path.join(sourceRoot, 'shared', 'wechat-pay-v3.ts'),
    path.join(sourceRoot, 'shared', 'x-video.ts'),
    ...functionNames.map((name) => path.join(sourceRoot, name, 'index.ts')),
  ],
  { stdio: 'inherit' },
);

const sharedCompileRoot = path.join(compileRoot, 'shared');
const libCompileRoot = path.join(compileRoot, '_lib');
const seedSharedFiles = [
  'plan-seed-data.js',
  'plan-seed.js',
  'appstore-country-data.js',
  'appstore-country-seed.js',
  'product-type-seed.js',
];
const functionsThatNeedSeedShared = new Set([
  'seed-database',
  'reset-database',
]);
const functionsThatNeedClientConfig = new Set([
  'create-order',
  'get-app-config',
  'retry-order',
]);
const functionsThatNeedInviteRewardPolicy = new Set([
  'fulfill-membership',
  'operator-api',
  'pay-notify',
  'pay-order',
  'user-login',
]);
const functionsThatNeedAiAccountPassword = new Set([
  'save-ai-account',
]);
const functionsThatNeedAiAccountEmailDomain = new Set([
  'reset-database',
  'seed-database',
]);
const functionsThatNeedAiNewsSort = new Set([
  'list-ai-news',
]);
const functionsThatNeedAppStoreProductScope = new Set([
  'operator-api',
]);
const functionsThatNeedXVideo = new Set([
  'operator-api',
]);
const functionsThatNeedAiToolShared = new Set([
  'get-ai-tool-run',
  'run-ai-tool',
  'summarize-ai-tool',
]);
const functionsThatNeedCloudbaseNodeSdk = new Set([
  'run-ai-tool',
  'summarize-ai-tool',
]);

for (const name of functionNames) {
  const targetRoot = path.join(deployRoot, name);
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(path.join(compileRoot, name), targetRoot, { recursive: true });
  const targetSharedRoot = path.join(targetRoot, 'shared');
  fs.cpSync(sharedCompileRoot, targetSharedRoot, { recursive: true });
  if (!functionsThatNeedSeedShared.has(name)) {
    for (const file of seedSharedFiles) {
      fs.rmSync(path.join(targetSharedRoot, file), { force: true });
    }
  }
  if (!functionsThatNeedClientConfig.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'client-config.js'), { force: true });
    fs.rmSync(path.join(targetSharedRoot, 'payment-config.js'), { force: true });
  }
  if (!functionsThatNeedInviteRewardPolicy.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'invite-reward-policy.js'), { force: true });
  }
  if (!functionsThatNeedAiAccountPassword.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'ai-account-password.js'), { force: true });
  }
  if (!functionsThatNeedAiAccountEmailDomain.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'ai-account-email-domain-core.js'), { force: true });
    fs.rmSync(path.join(targetSharedRoot, 'ai-account-email-domain.js'), { force: true });
  }
  if (!functionsThatNeedAiNewsSort.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'ai-news-sort.js'), { force: true });
  }
  if (!functionsThatNeedAppStoreProductScope.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'appstore-product-scope.js'), { force: true });
  }
  if (!functionsThatNeedXVideo.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'x-video.js'), { force: true });
  }
  if (!functionsThatNeedAiToolShared.has(name)) {
    fs.rmSync(path.join(targetSharedRoot, 'ai-tool-core.js'), { force: true });
    fs.rmSync(path.join(targetSharedRoot, 'ai-tool-generation.js'), { force: true });
    fs.rmSync(path.join(targetSharedRoot, 'ai-tool-service.js'), { force: true });
  }
  fs.cpSync(libCompileRoot, path.join(targetRoot, '_lib'), { recursive: true });
  const configFile = path.join(sourceRoot, name, 'config.json');
  if (fs.existsSync(configFile)) {
    fs.copyFileSync(configFile, path.join(targetRoot, 'config.json'));
  }
  const entryFile = path.join(targetRoot, 'index.js');
  const entrySource = fs
    .readFileSync(entryFile, 'utf8')
    .replaceAll('require("../shared/', 'require("./shared/')
    .replaceAll('require("../_lib/', 'require("./_lib/');
  fs.writeFileSync(entryFile, entrySource);
  fs.writeFileSync(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          ...(functionsThatNeedCloudbaseNodeSdk.has(name) ? { '@cloudbase/node-sdk': '3.18.4' } : {}),
          'wx-server-sdk': '^3.0.1',
        },
      },
      null,
      2,
    ),
  );
}

console.log(JSON.stringify({ compileRoot, deployRoot, functions: functionNames }, null, 2));
