import { useEffect, useMemo, useState } from 'react';
import { Button, Image, Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { PaymentLockOverlay } from '@/components/PaymentLockOverlay';
import { PopLayout } from '@/components/PopLayout';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { callCloudFunction } from '@/services/api';
import type { MembershipView, PlanView } from '@/types';
import { formatDate } from '@/utils/format';
import { isMobileBound } from '@/utils/mobile';
import { createPayOrderPayload, requestMiniProgramPayment, type PayOrderResult } from '@/utils/payment';
import { enableReminderSubscription } from '@/utils/subscription';
import { hideTabBarSafely, showTabBarSafely } from '@/utils/tabbar';

interface MemberHomeData {
  userInfo?: {
    mobile?: string;
    nickname?: string;
    avatarUrl?: string;
    pointsBalance?: number;
    aiAccount?: {
      registered: boolean;
      email?: string;
    };
  };
  membership: MembershipView;
  deliverySummary: {
    hasDeliveryInfo: boolean;
    emailAccount?: string;
    chatgptAccount?: string;
    expireAt?: number;
    expireTag?: string;
    remainDays?: number;
  };
  subscribeMsgAuth?: boolean;
}

interface ProductOption {
  code: string;
  label: string;
  tag: string;
  available: boolean;
  description: string;
}

interface ProductPlanOption {
  planCode: string;
  displayName: string;
  price: number;
  priceLabel: string;
  durationLabel: string;
  periodLabel?: string;
  recommended?: boolean;
}

interface PlanListResult {
  plans: PlanView[];
}

interface ProfileResult {
  mobile?: string;
}

interface CreateOrderResult {
  orderNo: string;
  amount?: number;
  originalAmount?: number;
  pointsDeducted?: number;
  pointsDeductAmount?: number;
}

interface BindMobileResult {
  success: boolean;
  mobile?: string;
}

interface SaveAiAccountResult {
  aiAccountRegistered: boolean;
  aiAccountEmail: string;
}

interface AiAccountResult {
  email: string;
  password: string;
}

interface LatestEmailCodeResult {
  hasCode: boolean;
  codeId?: string;
  email: string;
  code?: string | number;
  receivedAt?: number;
  expiresAt?: number;
  expired?: boolean;
}

interface CachedUserInfo {
  userId: string;
  openid?: string;
  openId?: string;
  nickname?: string;
  avatarUrl?: string;
  inviteCode?: string;
  pointsBalance?: number;
  aiAccountRegistered?: boolean;
  profileAuthed?: boolean;
}

interface LoginResult extends CachedUserInfo {
  mobileBound?: boolean;
}

interface AiAccountFormErrors {
  accountName?: string;
  password?: string;
  submit?: string;
}

interface WechatPhoneEvent {
  detail?: {
    code?: string;
    encryptedData?: string;
    iv?: string;
    errMsg?: string;
  };
}

const PRODUCT_OPTIONS: ProductOption[] = [
  {
    code: 'ai_news',
    label: 'Open AI 资讯会员',
    tag: '已上线',
    available: true,
    description: '适合 Open AI 资讯订阅、精选内容与会员权益场景。',
  },
  {
    code: 'claude_pro',
    label: 'Anthropic资讯会员',
    tag: '即将上线',
    available: false,
    description: '预留 Anthropic 资讯会员产品，后续接入独立套餐与交付信息。',
  },
];

const FALLBACK_PLAN_MAP: Record<string, ProductPlanOption[]> = {
  ai_news: [
    { planCode: 'plus', displayName: 'AI资讯PLUS会员', price: 0.01, priceLabel: '¥0.01', durationLabel: '30 天', periodLabel: '月', recommended: true },
    { planCode: 'go', displayName: 'AI资讯GO会员', price: 0.01, priceLabel: '¥0.01', durationLabel: '30 天', periodLabel: '月' },
  ],
  claude_pro: [
    { planCode: 'claude_waitlist', displayName: 'Anthropic资讯会员', price: 0, priceLabel: '即将上线', durationLabel: '敬请期待' },
  ],
};

const ACCOUNT_INFO_ICON = require('../../assets/member/account-info.svg') as string;
const CUSTOMER_SUPPORT_ICON = require('../../assets/member/customer-support.svg') as string;
const VERIFICATION_CODE_ICON = require('../../assets/member/verification-code.svg') as string;
const CHEVRON_RIGHT_ICON = require('../../assets/icons/chevron-right.svg') as string;
const CACHE_KEY = 'gpt_pay_user_info';
const AI_ACCOUNT_DOMAIN = '@mraclpivot.com';
const USER_AGREEMENT_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/htmls/%E7%94%A8%E6%88%B7%E5%8D%8F%E8%AE%AE.html?sign=55a2a34c2317b48fc09603658d7a64b1&t=1779005578';
const PRIVACY_AGREEMENT_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/htmls/%E9%9A%90%E7%A7%81%E5%8D%8F%E8%AE%AE.html?sign=3626cb47334346612df3a4d34746e859&t=1779005613';

function buildPlanOption(plan: PlanView, index: number): ProductPlanOption {
  const periodLabel = plan.durationDays >= 365 ? '年' : plan.durationDays >= 90 ? '季' : '月';
  return {
    planCode: plan.planCode,
    displayName: plan.planName,
    price: plan.price,
    priceLabel: `¥${plan.price.toFixed(2)}`,
    durationLabel: `${plan.durationDays} 天`,
    periodLabel,
    recommended: index === 0,
  };
}

export default function MemberPage(): JSX.Element {
  const [cachedUserInfo, setCachedUserInfo] = useState<CachedUserInfo | null>(null);
  const [data, setData] = useState<MemberHomeData>({
    membership: { status: 'none' },
    deliverySummary: { hasDeliveryInfo: false },
  });
  const [backendPlans, setBackendPlans] = useState<PlanView[]>([]);
  const [activeProductCode, setActiveProductCode] = useState('ai_news');
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [productIntroVisible, setProductIntroVisible] = useState(false);
  const [introProductCode, setIntroProductCode] = useState('ai_news');
  const [aiAccountSheetVisible, setAiAccountSheetVisible] = useState(false);
  const [pendingProductCode, setPendingProductCode] = useState('ai_news');
  const [aiAccountName, setAiAccountName] = useState('');
  const [aiAccountPassword, setAiAccountPassword] = useState('');
  const [aiAccountErrors, setAiAccountErrors] = useState<AiAccountFormErrors>({});
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [purchaseAgreementAccepted, setPurchaseAgreementAccepted] = useState(false);
  const [usePointsDeduction, setUsePointsDeduction] = useState(false);
  const [memberLoading, setMemberLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLocked, setPaymentLocked] = useState(false);

  useDidShow(() => {
    showTabBarSafely();
    loadCachedUserInfo();
    void loadData();
    void loadPlans();
  });

  useEffect(() => {
    if (!paymentLocked) return;

    hideTabBarSafely();
    return () => {
      showTabBarSafely();
    };
  }, [paymentLocked]);

  function loadCachedUserInfo(): void {
    const raw = Taro.getStorageSync(CACHE_KEY) as string;
    if (!raw) {
      setCachedUserInfo(null);
      return;
    }
    try {
      const cached = JSON.parse(raw) as CachedUserInfo;
      setCachedUserInfo(cached);
      if (cached.userId && !cached.openId && !cached.openid) {
        void refreshCachedOpenId(cached);
      }
    } catch {
      setCachedUserInfo(null);
    }
  }

  async function refreshCachedOpenId(cached: CachedUserInfo): Promise<void> {
    try {
      const loginResult = await callCloudFunction<LoginResult>('user-login', {
        nickname: cached.nickname,
        avatarUrl: cached.avatarUrl,
      });
      const nextInfo: CachedUserInfo = {
        ...cached,
        ...loginResult,
        openid: loginResult.openid ?? loginResult.openId,
        openId: loginResult.openId ?? loginResult.openid,
        profileAuthed: Boolean(loginResult.nickname || loginResult.avatarUrl),
      };
      Taro.setStorageSync(CACHE_KEY, JSON.stringify(nextInfo));
      setCachedUserInfo(nextInfo);
    } catch {
      // 不阻断会员中心渲染；重新授权登录后也会写入 openId。
    }
  }

  async function loadData(): Promise<void> {
    setMemberLoading(true);
    try {
      const result = await callCloudFunction<MemberHomeData>('get-member-home');
      setData(result);
    } finally {
      setMemberLoading(false);
    }
  }

  async function loadPlans(): Promise<void> {
    try {
      const result = await callCloudFunction<PlanListResult>('list-member-plans');
      setBackendPlans(result.plans);
      setSelectedPlanCode((prev) => prev || result.plans[0]?.planCode || '');
    } catch {
      setBackendPlans([]);
    }
  }

  const isActive = data.membership.status === 'active';
  const isOpening = data.membership.status === 'opening';
  const memberStatusLabel = data.membership.status === 'none' ? '立即开通' : data.membership.openStatusLabel ?? '立即开通';
  const planLabel = isActive || isOpening ? data.membership.planName ?? '会员套餐' : '普通会员';
  const remainDays = data.membership.remainDays ?? 0;
  const progress = Math.max(8, Math.min(100, isActive ? Math.round((remainDays / 30) * 100) : 8));
  const expiryLabel = data.membership.status === 'none' ? '购买后开始计时' : isOpening ? '人工开通中' : formatDate(data.membership.endAt);
  const currentProductCode = data.membership.productCode ?? 'ai_news';
  const mobileBound = isMobileBound(data.userInfo?.mobile);
  const nickname = data.userInfo?.nickname ?? cachedUserInfo?.nickname ?? '微信用户';
  const avatarUrl = data.userInfo?.avatarUrl ?? cachedUserInfo?.avatarUrl ?? '';
  const activeProduct = PRODUCT_OPTIONS.find((item) => item.code === activeProductCode) ?? PRODUCT_OPTIONS[0];
  const introProduct = PRODUCT_OPTIONS.find((item) => item.code === introProductCode) ?? PRODUCT_OPTIONS[0];
  const plansByProduct = useMemo(() => {
    const nextMap: Record<string, ProductPlanOption[]> = {};
    backendPlans.forEach((plan) => {
      const current = nextMap[plan.productCode] ?? [];
      current.push(buildPlanOption(plan, current.length));
      nextMap[plan.productCode] = current;
    });
    return nextMap;
  }, [backendPlans]);
  const activePlans = plansByProduct[activeProductCode] ?? FALLBACK_PLAN_MAP[activeProductCode] ?? [];
  const activeProductAvailable = activeProduct.available && activePlans.some((plan) => plan.price > 0);
  const selectedPlan = activePlans.find((plan) => plan.planCode === selectedPlanCode) ?? activePlans[0];
  const pointsBalance = Math.max(0, Math.floor(data.userInfo?.pointsBalance ?? cachedUserInfo?.pointsBalance ?? 0));
  const maxPointsDeducted = selectedPlan ? Math.min(pointsBalance, Math.floor(selectedPlan.price)) : 0;
  const pointsDeductAmount = maxPointsDeducted;
  const finalPayAmount = selectedPlan ? Math.max(0, Number((selectedPlan.price - (usePointsDeduction ? pointsDeductAmount : 0)).toFixed(2))) : 0;
  const pointsDeductionAvailable = activeProductAvailable && maxPointsDeducted > 0;
  const aiAccountRegistered = Boolean(data.userInfo?.aiAccount?.registered || data.userInfo?.aiAccount?.email || cachedUserInfo?.aiAccountRegistered);

  function openPlanSheet(productCode: string): void {
    const nextProduct = PRODUCT_OPTIONS.find((item) => item.code === productCode) ?? PRODUCT_OPTIONS[0];
    const nextPlans = plansByProduct[nextProduct.code] ?? FALLBACK_PLAN_MAP[nextProduct.code] ?? [];
    setActiveProductCode(nextProduct.code);
    setSelectedPlanCode(nextPlans[0]?.planCode ?? '');
    setPurchaseAgreementAccepted(false);
    setUsePointsDeduction(false);
    setPlanSheetVisible(true);
  }

  function openProductIntro(productCode: string): void {
    setIntroProductCode(productCode);
    setProductIntroVisible(true);
  }

  function closeProductIntro(): void {
    setProductIntroVisible(false);
  }

  function closePlanSheet(): void {
    setPlanSheetVisible(false);
    setPurchaseAgreementAccepted(false);
    setUsePointsDeduction(false);
  }

  function openAgreement(url: string): void {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(url)}`,
    });
  }

  function openSubscriptionFlow(productCode: string): void {
    const product = PRODUCT_OPTIONS.find((item) => item.code === productCode);
    if (!product?.available) {
      Taro.showToast({ title: product?.tag || '暂不支持购买', icon: 'none' });
      return;
    }
    setPendingProductCode(productCode);
    if (!aiAccountRegistered) {
      setAiAccountSheetVisible(true);
      return;
    }
    openPlanSheet(productCode);
  }

  function continueFromProductIntro(): void {
    if (!introProduct.available) {
      Taro.showToast({ title: introProduct.tag || '暂不支持购买', icon: 'none' });
      return;
    }
    setProductIntroVisible(false);
    openSubscriptionFlow(introProduct.code);
  }

  async function handleSaveAiAccount(): Promise<void> {
    if (submitting) {
      return;
    }
    const validationErrors = validateAiAccountForm(aiAccountName, aiAccountPassword);
    setAiAccountErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await callCloudFunction<SaveAiAccountResult>('save-ai-account', {
        accountName: aiAccountName.trim(),
        password: aiAccountPassword,
      });
      setData((prev) => ({
        ...prev,
        userInfo: {
          ...prev.userInfo,
          aiAccount: {
            registered: result.aiAccountRegistered,
            email: result.aiAccountEmail,
          },
        },
      }));
      updateCachedUserInfo({ aiAccountRegistered: result.aiAccountRegistered });
      setAiAccountSheetVisible(false);
      setAiAccountName('');
      setAiAccountPassword('');
      setAiAccountErrors({});
      openPlanSheet(pendingProductCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败，请稍后再试';
      const submit = message.includes('FunctionName') || message.includes('FUNCTION_NOT_FOUND')
        ? 'AI账号注册云函数未部署或未加入上传清单，请部署 save-ai-account 后重试'
        : message;
      setAiAccountErrors((prev) => ({ ...prev, submit }));
    } finally {
      setSubmitting(false);
    }
  }

  function updateCachedUserInfo(partial: Partial<CachedUserInfo>): void {
    const raw = Taro.getStorageSync(CACHE_KEY) as string;
    let current: CachedUserInfo | null = null;
    if (raw) {
      try {
        current = JSON.parse(raw) as CachedUserInfo;
      } catch {
        current = null;
      }
    }
    if (!current?.userId && !cachedUserInfo?.userId) {
      return;
    }
    const nextInfo = {
      ...(current ?? cachedUserInfo),
      ...partial,
    } as CachedUserInfo;
    Taro.setStorageSync(CACHE_KEY, JSON.stringify(nextInfo));
    setCachedUserInfo(nextInfo);
  }

  function validateAiAccountForm(accountName: string, password: string): AiAccountFormErrors {
    const errors: AiAccountFormErrors = {};
    const normalizedAccountName = accountName.trim().toLowerCase();
    if (!normalizedAccountName) {
      errors.accountName = '请输入AI账号';
    } else if (!/^[a-z][a-z0-9._-]{2,31}$/.test(normalizedAccountName)) {
      errors.accountName = '账号需为3-32位小写字母开头，可含数字、点、下划线或中划线';
    } else if (normalizedAccountName.includes('..') || normalizedAccountName.startsWith('.') || normalizedAccountName.endsWith('.')) {
      errors.accountName = '账号格式不正确，请调整点号位置';
    }

    if (!password) {
      errors.password = '请输入账号密码';
    } else if (password.length < 8 || password.length > 64) {
      errors.password = '密码需为8-64位';
    } else if (/\s/.test(password)) {
      errors.password = '密码不能包含空格';
    } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      errors.password = '密码需包含大小写字母、数字和特殊符号';
    }

    return errors;
  }

  async function createOrder(): Promise<CreateOrderResult> {
    if (!purchaseAgreementAccepted) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      throw new Error('未同意协议');
    }
    if (!selectedPlanCode) {
      Taro.showToast({ title: '请选择会员方案', icon: 'none' });
      throw new Error('未选择会员方案');
    }
    return callCloudFunction<CreateOrderResult>('create-order', {
      planCode: selectedPlanCode,
      usePointsDeduction,
    });
  }

  async function payOrder(orderNo: string, lockAlreadyEnabled = false): Promise<void> {
    if (!lockAlreadyEnabled) {
      setPaymentLocked(true);
    }
    try {
      const result = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(orderNo));
      if (result.paid || !result.payment && !result.virtualPayment) {
        closePlanSheet();
        Taro.navigateTo({ url: `/pages/pay-result/index?orderNo=${orderNo}` });
        return;
      }
      try {
        await requestMiniProgramPayment(result);
      } finally {
        closePlanSheet();
        Taro.navigateTo({ url: `/pages/pay-result/index?orderNo=${orderNo}` });
      }
    } catch (error) {
      throw error;
    } finally {
      setPaymentLocked(false);
    }
  }

  async function handlePlanPay(): Promise<void> {
    if (!activeProductAvailable) {
      Taro.showToast({ title: '该会员方案即将上线', icon: 'none' });
      return;
    }
    if (!purchaseAgreementAccepted) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setPaymentLocked(true);
    try {
      const profile = await callCloudFunction<ProfileResult>('get-profile');
      if (!isMobileBound(profile.mobile)) {
        Taro.showToast({ title: '请先授权微信手机号', icon: 'none' });
        return;
      }
      const order = await createOrder();
      await payOrder(order.orderNo, true);
    } finally {
      setSubmitting(false);
      setPaymentLocked(false);
    }
  }

  async function handleGetPhoneNumber(event: WechatPhoneEvent): Promise<void> {
    if (!purchaseAgreementAccepted) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }
    const detail = event.detail;
    if (!detail?.code) {
      Taro.showToast({ title: detail?.errMsg?.includes('deny') ? '你已取消手机号授权' : '未获取到手机号授权', icon: 'none' });
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setPaymentLocked(true);
    try {
      const bindResult = await callCloudFunction<BindMobileResult>('bind-mobile', {
        source: 'wechat_phone',
        code: detail.code,
        encryptedData: detail.encryptedData,
        iv: detail.iv,
      });
      setData((prev) => ({ ...prev, userInfo: { ...prev.userInfo, mobile: bindResult.mobile } }));
      const order = await createOrder();
      await payOrder(order.orderNo, true);
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '授权失败，请稍后再试', icon: 'none' });
    } finally {
      setSubmitting(false);
      setPaymentLocked(false);
    }
  }

  async function handleShowAiAccount(): Promise<void> {
    try {
      Taro.showLoading({
        title: '加载中',
        mask: true,
      });
      const result = await callCloudFunction<AiAccountResult>('get-ai-account');
      Taro.hideLoading();
      const modalResult = await Taro.showModal({
        title: 'AI账号信息',
        content: `账号：\n${result.email}\n\n密码：\n${result.password}`,
        confirmText: '复制',
        cancelText: '关闭',
      });
      if (modalResult.confirm) {
        await Taro.setClipboardData({ data: result.password });
      }
    } catch (error) {
      Taro.hideLoading();
      Taro.showToast({ title: error instanceof Error ? error.message : '账号信息获取失败', icon: 'none' });
    }
  }

  async function handleShowLatestEmailCode(): Promise<void> {
    let result: LatestEmailCodeResult;
    try {
      Taro.showLoading({
        title: '加载中',
        mask: true,
      });
      result = await callCloudFunction<LatestEmailCodeResult>('get-latest-email-code');
    } catch (error) {
      Taro.hideLoading();
      await Taro.showModal({
        title: '验证码获取失败',
        content: error instanceof Error ? error.message : '请稍等几秒后重试',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }

    Taro.hideLoading();
    const verificationCode = result.code ? String(result.code).trim() : '';
    if (!verificationCode) {
      await Taro.showModal({
        title: '暂无验证码',
        content: '暂未获取到最新登录验证码。请确认已在 ChatGPT 登录页点击重新发送，然后稍等几秒后重试。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }

    const modalResult = await Taro.showModal({
      title: '获取验证码',
      content: `账号：\n${result.email}\n\n验证码：\n${verificationCode}${result.expired ? '\n\n提示：这是最近一次未复制的验证码，可能已过期。如不可用，请在 ChatGPT 登录页重新发送。' : ''}`,
      confirmText: '复制',
      cancelText: '关闭',
    });
    if (!modalResult.confirm) {
      return;
    }

    await Taro.setClipboardData({ data: verificationCode });
    if (result.codeId) {
      try {
        await callCloudFunction<{ success: boolean }>('clear-email-code', { codeId: result.codeId });
      } catch {
        // 复制已完成，清除失败不打断用户；下一次仍会受过期时间保护。
      }
    }
  }

  return (
    <SaasPageFrame
      title='会员中心'
      showBack={false}
      onBack={() => {
        if (paymentLocked) {
          Taro.showToast({ title: '支付处理中，请勿返回', icon: 'none' });
        }
      }}
    >
      <View className='member-page'>
      <View className='saas-shell member-shell'>
        <View className='member-premium-card'>
          {memberLoading ? (
            <View className='member-card-skeleton'>
              <View className='member-card-skeleton__head'>
                <View className='member-card-skeleton__avatar' />
                <View className='member-card-skeleton__pill' />
              </View>
              <View className='member-card-skeleton__label' />
              <View className='member-card-skeleton__title' />
              <View className='member-card-skeleton__days' />
              <View className='member-card-skeleton__bar' />
            </View>
          ) : (
            <>
              <View className='member-profile'>
                <View className='member-profile__avatar'>
                  {avatarUrl ? (
                    <Image className='member-profile__avatar-image' src={avatarUrl} mode='aspectFill' />
                  ) : (
                    <Text>{nickname.slice(0, 1).toUpperCase()}</Text>
                  )}
                  <Text className='member-profile__ai'>AI</Text>
                </View>
                <View className='member-profile__copy'>
                  <Text
                    className={`member-plan-title__status member-plan-title__status--${data.membership.status}`}
                    onClick={() => data.membership.status === 'none' && openSubscriptionFlow(currentProductCode)}
                  >
                    {memberStatusLabel}
                  </Text>
                </View>
              </View>
              <View className='member-plan-title'>
                <Text className='member-plan-title__label'>当前方案</Text>
                <View className='member-plan-title__row'>
                  <Text className='member-plan-title__name'>{planLabel}</Text>
                </View>
              </View>
              <View className='member-days'>
                <View>
                  <Text className='member-days__value'>{remainDays}</Text>
                  <Text className='member-days__label'>剩余天数</Text>
                </View>
                <Text className='member-days__expiry'>到期时间 {expiryLabel}</Text>
              </View>
              <View className='member-progress'>
                <View className='member-progress__bar' style={{ width: `${progress}%` }} />
              </View>
            </>
          )}
        </View>

        <View className='member-section'>
          <Text className='member-section__title'>服务与支持</Text>
          <View className='member-list-card'>
            <View className='member-service-item' onClick={() => void handleShowAiAccount()}>
              <View className='member-service-item__icon'>
                <Image className='member-service-item__image' src={ACCOUNT_INFO_ICON} mode='aspectFit' />
              </View>
              <View className='member-service-item__copy'>
                <Text className='member-service-item__title'>账号信息</Text>
                <Text className='member-service-item__desc'>管理您的账号与安全</Text>
              </View>
              <Image className='member-service-item__arrow' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
            </View>
            <View className='member-divider' />
            <View className='member-service-item' onClick={() => void handleShowLatestEmailCode()}>
              <View className='member-service-item__icon'>
                <Image className='member-service-item__image' src={VERIFICATION_CODE_ICON} mode='aspectFit' />
              </View>
              <View className='member-service-item__copy'>
                <Text className='member-service-item__title'>最近验证码</Text>
                <Text className='member-service-item__desc'>查看登录验证码</Text>
              </View>
              <Image className='member-service-item__arrow' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
            </View>
            <View className='member-divider' />
            <View className='member-service-item'>
              <View className='member-service-item__icon'>
                <Image className='member-service-item__image' src={CUSTOMER_SUPPORT_ICON} mode='aspectFit' />
              </View>
              <View className='member-service-item__copy'>
                <Text className='member-service-item__title'>我的客服</Text>
                <Text className='member-service-item__desc'>24/7 智能与人工支持</Text>
              </View>
              <Image className='member-service-item__arrow' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
            </View>
          </View>
        </View>

        <View className='member-section'>
          <Text className='member-section__title'>我的权益</Text>
          <View className='member-list-card'>
            {PRODUCT_OPTIONS.map((product) => (
              <View
                key={product.code}
                className={`member-right-item ${product.available ? '' : 'member-right-item--disabled'}`}
                onClick={() => openProductIntro(product.code)}
              >
                <View>
                  <Text className='member-right-item__title'>{product.label}</Text>
                  <Text className='member-right-item__desc'>
                    {product.code === currentProductCode && isActive ? '当前开通' : product.tag}
                  </Text>
                </View>
                <View className={`ios-switch ${product.available ? 'ios-switch--on' : ''}`}>
                  <Text className='ios-switch__thumb' />
                </View>
              </View>
            ))}
            <View className='member-divider' />
            <View className='member-right-item'>
              <View>
                <Text className='member-right-item__title'>开启到期提醒</Text>
                <Text className='member-right-item__desc'>会员到期前通知提醒</Text>
              </View>
              <View
                className={`ios-switch ${data.subscribeMsgAuth ? 'ios-switch--on' : ''}`}
                onClick={() => {
                  void enableReminderSubscription().then((changed) => {
                    if (changed) {
                      void loadData();
                    }
                  });
                }}
              >
                <Text className='ios-switch__thumb' />
              </View>
            </View>
          </View>
        </View>

        {/* <Button className='saas-button member-upgrade-button' onClick={() => openPlanSheet(currentProductCode)}>
          升级服务
        </Button> */}
      </View>

      <PopLayout visible={productIntroVisible} onClose={closeProductIntro} panelClassName='product-intro-sheet'>
        <View className='plan-sheet__head'>
          <View>
            <Text className='plan-sheet__label'>商品介绍</Text>
            <Text className='plan-sheet__title'>{introProduct.label}</Text>
          </View>
          <Text className='plan-sheet__close' onClick={closeProductIntro}>×</Text>
        </View>
        <Text className='plan-sheet__desc'>{introProduct.description}</Text>
        <View className='product-intro-list'>
          <View className='product-intro-item'>
            <Text className='product-intro-item__title'>精选资讯</Text>
            <Text className='product-intro-item__desc'>聚合前沿 AI 动态、产品更新与应用案例。</Text>
          </View>
          <View className='product-intro-item'>
            <Text className='product-intro-item__title'>会员权益</Text>
            <Text className='product-intro-item__desc'>开通后进入人工处理流程，完成后展示会员有效期。</Text>
          </View>
          <View className='product-intro-item'>
            <Text className='product-intro-item__title'>当前状态</Text>
            <Text className='product-intro-item__desc'>{introProduct.available ? '支持购买' : introProduct.tag}</Text>
          </View>
        </View>
        <Button
          className={`saas-button plan-sheet__button ${introProduct.available ? '' : 'saas-button--disabled'}`}
          onClick={continueFromProductIntro}
        >
          {introProduct.available ? '查看套餐' : introProduct.tag}
        </Button>
      </PopLayout>

      <PopLayout visible={aiAccountSheetVisible} onClose={() => setAiAccountSheetVisible(false)} panelClassName='ai-account-sheet'>
        <View className='plan-sheet__head'>
          <View>
            <Text className='plan-sheet__label'>AI 账号注册</Text>
            <Text className='plan-sheet__title'>注册交付账号</Text>
          </View>
          <Text className='plan-sheet__close' onClick={() => setAiAccountSheetVisible(false)}>×</Text>
        </View>
        <Text className='plan-sheet__desc'>请填写用于后台系统注册和交付的账号前缀，系统会自动拼接 {AI_ACCOUNT_DOMAIN}。注册成功后将继续选择套餐。</Text>
        <View className='ai-account-form'>
          <View className='ai-account-field'>
            <Text className='ai-account-field__label'>AI账号</Text>
            <Input
              className='ai-account-field__input'
              value={aiAccountName}
              placeholder='请输入账号前缀'
              type='text'
              onInput={(event) => {
                setAiAccountName(event.detail.value);
                setAiAccountErrors((prev) => ({ ...prev, accountName: undefined, submit: undefined }));
              }}
            />
            <Text className='ai-account-field__suffix'>{AI_ACCOUNT_DOMAIN}</Text>
            {aiAccountErrors.accountName ? <Text className='ai-account-field__error'>{aiAccountErrors.accountName}</Text> : null}
          </View>
          <View className='ai-account-field'>
            <Text className='ai-account-field__label'>账号密码</Text>
            <Input
              className='ai-account-field__input'
              value={aiAccountPassword}
              placeholder='8-64位，含大小写字母、数字和特殊符号'
              password
              onInput={(event) => {
                setAiAccountPassword(event.detail.value);
                setAiAccountErrors((prev) => ({ ...prev, password: undefined, submit: undefined }));
              }}
            />
            {aiAccountErrors.password ? <Text className='ai-account-field__error'>{aiAccountErrors.password}</Text> : null}
          </View>
        </View>
        {aiAccountErrors.submit ? <Text className='ai-account-form__error'>{aiAccountErrors.submit}</Text> : null}
        <Button className='saas-button plan-sheet__button' loading={submitting} onClick={() => void handleSaveAiAccount()}>
          立即注册
        </Button>
      </PopLayout>

      <PopLayout visible={planSheetVisible} onClose={closePlanSheet} panelClassName='plan-sheet'>
            <View className='plan-sheet__head'>
              <View>
                <Text className='plan-sheet__label'>会员方案</Text>
                <Text className='plan-sheet__title'>{activeProduct.label}</Text>
              </View>
              <Text className='plan-sheet__close' onClick={closePlanSheet}>×</Text>
            </View>
            <Text className='plan-sheet__desc'>{activeProduct.description}</Text>
            <View className='plan-sheet__plans'>
              {activePlans.map((plan) => {
                const selected = plan.planCode === selectedPlanCode;
                return (
                  <View
                    key={plan.planCode}
                    className={`plan-option ${selected ? 'plan-option--selected' : ''}`}
                    onClick={() => setSelectedPlanCode(plan.planCode)}
                  >
                    <View>
                      <Text className='plan-option__name'>{plan.displayName}</Text>
                      <Text className='plan-option__duration'>{plan.durationLabel}</Text>
                    </View>
                    <View className='plan-option__price-row'>
                      <Text className='plan-option__price'>{plan.price > 0 ? `¥${plan.price.toFixed(2)}` : plan.priceLabel}</Text>
                      {plan.periodLabel ? <Text className='plan-option__period'>/ {plan.periodLabel}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <View className={`plan-sheet__points ${usePointsDeduction ? 'plan-sheet__points--active' : ''} ${pointsDeductionAvailable ? '' : 'plan-sheet__points--disabled'}`}>
              <View>
                <Text className='plan-sheet__points-title'>使用积分抵扣</Text>
                <Text className='plan-sheet__points-desc'>
                  {pointsDeductionAvailable
                    ? `可用 ${pointsBalance} 积分，本次抵扣 ¥${pointsDeductAmount.toFixed(2)}`
                    : `可用 ${pointsBalance} 积分，满 1 积分可抵 ¥1`}
                </Text>
                {selectedPlan ? (
                  <Text className='plan-sheet__points-pay'>预计支付 ¥{finalPayAmount.toFixed(2)}</Text>
                ) : null}
              </View>
              <View
                className={`ios-switch ${usePointsDeduction ? 'ios-switch--on' : ''}`}
                onClick={() => {
                  if (!pointsDeductionAvailable) {
                    Taro.showToast({ title: '暂无可抵扣积分', icon: 'none' });
                    return;
                  }
                  setUsePointsDeduction((enabled) => !enabled);
                }}
              >
                <Text className='ios-switch__thumb' />
              </View>
            </View>
            <View className='plan-sheet__agreement'>
              <View
                className={`plan-sheet__checkbox ${purchaseAgreementAccepted ? 'plan-sheet__checkbox--checked' : ''}`}
                onClick={() => setPurchaseAgreementAccepted((accepted) => !accepted)}
              >
                {purchaseAgreementAccepted ? <Text className='plan-sheet__checkmark'>✓</Text> : null}
              </View>
              <Text className='plan-sheet__agreement-text'>我已阅读并同意</Text>
              <Text className='plan-sheet__link' onClick={() => openAgreement(USER_AGREEMENT_URL)}>《用户协议》</Text>
              <Text className='plan-sheet__link' onClick={() => openAgreement(PRIVACY_AGREEMENT_URL)}>《隐私政策》</Text>
            </View>
            {activeProductAvailable && !mobileBound ? (
              <Button
                className={`saas-button plan-sheet__button ${purchaseAgreementAccepted ? '' : 'saas-button--disabled'}`}
                openType={purchaseAgreementAccepted ? 'getPhoneNumber' : undefined}
                loading={submitting}
                onClick={() => {
                  if (!purchaseAgreementAccepted) {
                    Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
                  }
                }}
                onGetPhoneNumber={handleGetPhoneNumber}
              >
                授权手机号并支付
              </Button>
            ) : (
              <Button className={`saas-button plan-sheet__button ${activeProductAvailable && purchaseAgreementAccepted ? '' : 'saas-button--disabled'}`} loading={submitting} onClick={() => void handlePlanPay()}>
                {activeProductAvailable ? '确认支付' : '即将上线'}
              </Button>
            )}
      </PopLayout>

      <PaymentLockOverlay visible={paymentLocked} />
      </View>
    </SaasPageFrame>
  );
}
