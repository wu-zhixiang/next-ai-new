import type { UserConfigExport } from '@tarojs/cli';

const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"',
  },
  defineConstants: {
    RENEW_REMINDER_TEMPLATE_ID: JSON.stringify(process.env.TARO_APP_RENEW_REMINDER_TEMPLATE_ID || ''),
  },
  mini: {},
  h5: {},
};

export default config;
