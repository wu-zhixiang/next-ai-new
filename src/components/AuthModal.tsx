import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { loginSilently, saveCachedUserInfo, type CachedUserInfo } from '@/utils/auth';
import { hideTabBarSafely, showTabBarSafely } from '@/utils/tabbar';
import './AuthModal.scss';

const USER_AGREEMENT_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/htmls/%E7%94%A8%E6%88%B7%E5%8D%8F%E8%AE%AE.html?sign=55a2a34c2317b48fc09603658d7a64b1&t=1779005578';
const PRIVACY_AGREEMENT_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/htmls/%E9%9A%90%E7%A7%81%E5%8D%8F%E8%AE%AE.html?sign=3626cb47334346612df3a4d34746e859&t=1779005613';

export type AuthUserInfo = CachedUserInfo;

interface AuthModalProps {
  visible: boolean;
  inviteCode?: string;
  onAuthSuccess: (info: AuthUserInfo) => void;
}

export default function AuthModal({ visible, inviteCode, onAuthSuccess }: AuthModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAgreementAccepted(false);

    hideTabBarSafely();
    return () => {
      showTabBarSafely();
    };
  }, [visible]);

  if (!visible) return null;

  async function handleWechatLogin() {
    if (submitting) return;
    if (!agreementAccepted) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      let nickname = '';
      let avatarUrl = '';
      try {
        const profile = await Taro.getUserProfile({
          desc: '用于完善会员资料与展示账号信息',
        });
        nickname = profile.userInfo.nickName;
        avatarUrl = profile.userInfo.avatarUrl;
      } catch (error) {
        console.warn('auth.profile.failed', error);
      }

      const cachedInfo = await loginSilently({
        nickname,
        avatarUrl,
        inviteCode,
        source: inviteCode ? 'share' : 'direct',
      });
      saveCachedUserInfo(cachedInfo);
      onAuthSuccess(cachedInfo);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '授权登录失败，请稍后再试',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openAgreement(url: string): void {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(url)}`,
    });
  }

  function toggleAgreement(): void {
    setAgreementAccepted((accepted) => !accepted);
  }

  return (
    <View className='auth-modal'>
      <View className='auth-modal__mask' />
      <View className='auth-modal__card'>
        <View className='auth-modal__icon'>AI</View>
        <Text className='auth-modal__title'>欢迎进入 AIO Version</Text>
        <Text className='auth-modal__desc'>登录后同步会员状态、邀请积分与服务记录</Text>
        <Button
          className={`auth-modal__button ${agreementAccepted ? '' : 'auth-modal__button--disabled'}`}
          loading={submitting}
          onClick={() => void handleWechatLogin()}
        >
          微信授权登录
        </Button>
        <View className='auth-modal__agreement'>
          <View
            className={`auth-modal__checkbox ${agreementAccepted ? 'auth-modal__checkbox--checked' : ''}`}
            onClick={toggleAgreement}
          >
            {agreementAccepted ? <Text className='auth-modal__checkmark'>✓</Text> : null}
          </View>
          <Text className='auth-modal__agreement-text' onClick={toggleAgreement}>我已阅读并同意</Text>
          <Text className='auth-modal__link' onClick={() => openAgreement(USER_AGREEMENT_URL)}>《用户协议》</Text>
          <Text className='auth-modal__link' onClick={() => openAgreement(PRIVACY_AGREEMENT_URL)}>《隐私政策》</Text>
        </View>
      </View>
    </View>
  );
}
