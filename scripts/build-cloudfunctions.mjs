import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'cloudfunctions');
const compileRoot = path.join('/private/tmp', 'gpt-pay-cloudfunctions-compiled');
const deployRoot = path.join('/private/tmp', 'gpt-pay-cloudfunctions-deploy');
const functionNames = [
  'bind-mobile',
  'create-order',
  'get-member-home',
  'get-pay-result',
  'get-profile',
  'list-member-plans',
  'pay-notify',
  'pay-order',
  'save-subscribe-auth',
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
    path.join(sourceRoot, 'shared', 'db.ts'),
    path.join(sourceRoot, 'shared', 'types.ts'),
    path.join(sourceRoot, 'shared', 'utils.ts'),
    path.join(sourceRoot, 'shared', 'wechat.ts'),
    ...functionNames.map((name) => path.join(sourceRoot, name, 'index.ts')),
  ],
  { stdio: 'inherit' },
);

const sharedCompileRoot = path.join(compileRoot, 'shared');
const libCompileRoot = path.join(compileRoot, '_lib');

for (const name of functionNames) {
  const targetRoot = path.join(deployRoot, name);
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(path.join(compileRoot, name), targetRoot, { recursive: true });
  fs.cpSync(sharedCompileRoot, path.join(targetRoot, 'shared'), { recursive: true });
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
