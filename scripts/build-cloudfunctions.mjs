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
  'get-member-home',
  'get-ai-account',
  'get-ai-news-detail',
  'get-app-config',
  'get-invite-home',
  'get-latest-email-code',
  'get-pay-result',
  'get-profile',
  'list-ai-news',
  'list-orders',
  'list-member-plans',
  'list-appstore-countries',
  'list-product-types',
  'operator-api',
  'pay-notify',
  'pay-order',
  'reset-database',
  'retry-order',
  'save-ai-account',
  'save-subscribe-auth',
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
    path.join(sourceRoot, 'shared', 'ai-account.ts'),
    path.join(sourceRoot, 'shared', 'db.ts'),
    path.join(sourceRoot, 'shared', 'operator-notify.ts'),
    path.join(sourceRoot, 'shared', 'orders.ts'),
    path.join(sourceRoot, 'shared', 'plan-seed.ts'),
    path.join(sourceRoot, 'shared', 'appstore-country-seed.ts'),
    path.join(sourceRoot, 'shared', 'product-type-seed.ts'),
    path.join(sourceRoot, 'shared', 'types.ts'),
    path.join(sourceRoot, 'shared', 'utils.ts'),
    path.join(sourceRoot, 'shared', 'wechat.ts'),
    ...functionNames.map((name) => path.join(sourceRoot, name, 'index.ts')),
  ],
  { stdio: 'inherit' },
);

const sharedCompileRoot = path.join(compileRoot, 'shared');
const libCompileRoot = path.join(compileRoot, '_lib');
const seedSharedFiles = [
  'plan-seed.js',
  'appstore-country-seed.js',
  'product-type-seed.js',
];
const functionsThatNeedSeedShared = new Set([
  'seed-database',
  'reset-database',
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
          'wx-server-sdk': '^3.0.1',
        },
      },
      null,
      2,
    ),
  );
}

console.log(JSON.stringify({ compileRoot, deployRoot, functions: functionNames }, null, 2));
