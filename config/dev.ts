import type { UserConfigExport } from '@tarojs/cli';

const NEWS_REMINDER_TEMPLATE_ID = 'm7Cb5rMgtJtFdyVn3YvR671tWZwyK87qe6qKr7KPZrQ';

const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"',
  },
  defineConstants: {
    RENEW_REMINDER_TEMPLATE_ID: JSON.stringify(process.env.TARO_APP_RENEW_REMINDER_TEMPLATE_ID || ''),
    MEMBER_OPENED_TEMPLATE_ID: JSON.stringify(process.env.TARO_APP_MEMBER_OPENED_TEMPLATE_ID || ''),
    NEWS_REMINDER_TEMPLATE_ID: JSON.stringify(process.env.TARO_APP_NEWS_REMINDER_TEMPLATE_ID || NEWS_REMINDER_TEMPLATE_ID),
    AI_TOOL_REWARD_AD_UNIT_ID: JSON.stringify(process.env.TARO_APP_AI_TOOL_REWARD_AD_UNIT_ID || ''),
  },
  mini: {},
  h5: {},
};

export default config;
