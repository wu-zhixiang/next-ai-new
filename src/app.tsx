import { PropsWithChildren, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { loginSilently } from '@/utils/auth';
import './styles/app.scss';

const CLOUDBASE_ENV_ID = 'cloud1-d3gbrpive8611514c';

function App({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({
        env: CLOUDBASE_ENV_ID,
        traceUser: true,
      });
      void loginSilently().catch((error) => {
        console.warn('app.silentLogin.failed', error);
      });
    }
  }, []);

  return children as JSX.Element;
}

export default App;
