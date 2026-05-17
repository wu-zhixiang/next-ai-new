import type { UserConfigExport } from '@tarojs/cli';

const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {},
  mini: {},
  h5: {},
};

export default config;
