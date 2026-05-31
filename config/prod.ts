import type { UserConfigExport } from '@tarojs/cli';

const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {
    RENEW_REMINDER_TEMPLATE_ID: JSON.stringify(process.env.TARO_APP_RENEW_REMINDER_TEMPLATE_ID || ''),
    MEMBER_OPENED_TEMPLATE_ID: JSON.stringify(process.env.TARO_APP_MEMBER_OPENED_TEMPLATE_ID || ''),
    AI_TOOL_REWARD_AD_UNIT_ID: JSON.stringify(process.env.TARO_APP_AI_TOOL_REWARD_AD_UNIT_ID || ''),
  },
  mini: {},
  h5: {},
};

export default config;
