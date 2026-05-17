import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const appid = 'wx1bbde9dcd7559d54';
const envId = 'cloud1-d3gbrpive8611514c';
const projectPath = process.cwd();
const privateKeyPath = '/Users/qitmac001343/.codex/private.wx1bbde9dcd7559d54.key';
const deployRoot = path.join(projectPath, 'cloudfunctions-deploy');

const functions = [
  'bind-mobile',
  'create-order',
  'get-member-home',
  'get-ai-account',
  'get-invite-home',
  'get-pay-result',
  'get-profile',
  'list-orders',
  'list-member-plans',
  'pay-notify',
  'pay-order',
  'save-ai-account',
  'save-subscribe-auth',
  'seed-database',
  'user-login',
];

function assertPrerequisites() {
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`未找到小程序上传密钥: ${privateKeyPath}`);
  }

  for (const name of functions) {
    const functionDir = path.join(deployRoot, name);
    if (!fs.existsSync(functionDir)) {
      throw new Error(`未找到云函数发布目录: ${functionDir}`);
    }
  }
}

function uploadFunction(name) {
  const functionDir = path.join(deployRoot, name);
  execFileSync(
    'npx',
    [
      'miniprogram-ci',
      'cloud',
      'functions',
      'upload',
      '--pp',
      projectPath,
      '--appid',
      appid,
      '--pkp',
      privateKeyPath,
      '--env',
      envId,
      '--name',
      name,
      '--path',
      functionDir,
      '--remote-npm-install',
      'true',
    ],
    { stdio: 'inherit' },
  );
}

function invokeFunction(name, data) {
  const payload = JSON.stringify(data);
  return execFileSync(
    'npx',
    [
      'miniprogram-ci',
      'cloud',
      'functions',
      'invoke',
      '--pp',
      projectPath,
      '--appid',
      appid,
      '--pkp',
      privateKeyPath,
      '--env',
      envId,
      '--name',
      name,
      '--data',
      payload,
    ],
    { encoding: 'utf8' },
  );
}

assertPrerequisites();

const mode = process.argv[2] ?? 'upload';

if (mode === 'upload') {
  for (const name of functions) {
    uploadFunction(name);
  }
} else if (mode === 'invoke') {
  const functionName = process.argv[3];
  const payload = process.argv[4] ? JSON.parse(process.argv[4]) : {};
  if (!functionName) {
    throw new Error('invoke 模式缺少函数名');
  }
  const output = invokeFunction(functionName, payload);
  console.log(output);
} else {
  throw new Error(`不支持的模式: ${mode}`);
}
