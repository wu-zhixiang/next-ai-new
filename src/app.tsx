import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';
import './styles/app.scss';

const CLOUDBASE_ENV_ID = 'cloud1-d3gbrpive8611514c';

function App({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({
        env: CLOUDBASE_ENV_ID,
        traceUser: true,
      });

      void callCloudFunction('user-login').catch(() => {
        // 页面内按需处理登录失败，这里只做静默初始化
      });
    }
  }, []);

  return children as JSX.Element;
}

export default App;
