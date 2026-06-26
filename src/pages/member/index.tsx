import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, Image, Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import AuthModal, { type AuthUserInfo } from '@/components/AuthModal';
import { PaymentLockOverlay } from '@/components/PaymentLockOverlay';
import { PopLayout } from '@/components/PopLayout';
import { SaasPageFrame, type PageTheme } from '@/components/SaasPageFrame';
import { Skeleton } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import type { MembershipView, PlanView, ProductTypeView } from '@/types';
import { AUTH_CACHE_KEY, getCachedUserInfo, saveCachedUserInfo, type CachedUserInfo, type LoginResult } from '@/utils/auth';
import { formatDate } from '@/utils/format';
import { isMobileBound } from '@/utils/mobile';
import { createPayOrderPayload, requestMiniProgramPayment, type PayOrderResult } from '@/utils/payment';
import { disableReminderSubscription, enableReminderSubscription } from '@/utils/subscription';
import { hideTabBarSafely, showTabBarSafely } from '@/utils/tabbar';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';
import { consumePromotedProductCode } from '@/utils/productNavigation';
import { loadClientAppConfig } from '@/utils/appConfig';
import {
  toCompliantMembership,
  toCompliantPlan,
  toCompliantProductType,
} from '@/utils/productCompliance';
import { hasAuthConsent } from '@/utils/authConsent';
import { copyWithToast, maskSecret, type ClipboardLabel } from '@/utils/clipboard';
import {
  AI_ACCOUNT_PASSWORD_HINT,
  validateAiAccountPassword,
} from '@/utils/aiAccountPassword';
import { requirePrivacyAuthorization } from '@/utils/privacyAuthorization';

interface MemberHomeData {
  userInfo?: {
    mobile?: string;
    nickname?: string;
    avatarUrl?: string;
    pointsBalance?: number;
    aiAccount?: {
      registered: boolean;
      email?: string;
      emailDomain?: string;
      emailDomainAvailable?: boolean;
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

interface ProductPlanOption {
  pid?: string;
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

interface ProductTypeListResult {
  productTypes: ProductTypeView[];
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

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const EMAIL_CODE_VISIBLE_WINDOW_MS = 5 * MINUTE_MS;

function formatRemainCountdown(endAt?: number, now = Date.now()): { value: string; label: string; remainMs: number } {
  if (!endAt) {
    return { value: '0', label: '剩余时间', remainMs: 0 };
  }
  const remainMs = Math.max(0, endAt - now);
  const days = Math.floor(remainMs / DAY_MS);
  return {
    value: String(days),
    label: '剩余天数',
    remainMs,
  };
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

function isEmailCodeTooOld(receivedAt?: number, now = Date.now()): boolean {
  return typeof receivedAt === 'number' && now - receivedAt > EMAIL_CODE_VISIBLE_WINDOW_MS;
}

interface AiAccountFormErrors {
  accountName?: string;
  password?: string;
  submit?: string;
}

type AiAccountSheetSource = 'purchase' | 'profile';
type PendingAuthAction =
  | { type: 'subscribe'; productCode: string }
  | { type: 'saveAiAccount' };

interface WechatPhoneEvent {
  detail?: {
    code?: string;
    encryptedData?: string;
    iv?: string;
    errMsg?: string;
  };
}

const ACCOUNT_INFO_ICON = require('../../assets/member/account-info.svg') as string;
const CUSTOMER_SUPPORT_ICON = require('../../assets/member/customer-support.svg') as string;
const VERIFICATION_CODE_ICON = require('../../assets/member/verification-code.svg') as string;
const MESSAGE_REMINDER_ICON = require('../../assets/member/message-reminder.svg') as string;
const CHEVRON_RIGHT_ICON = require('../../assets/icons/chevron-right.svg') as string;
const CACHE_KEY = AUTH_CACHE_KEY;
const DEFAULT_AI_ACCOUNT_EMAIL_SUFFIX = '@mraclpivot.com';
const USER_AGREEMENT_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/htmls/%E7%94%A8%E6%88%B7%E5%8D%8F%E8%AE%AE.html?sign=55a2a34c2317b48fc09603658d7a64b1&t=1779005578';
const PRIVACY_AGREEMENT_URL = 'https://cloud1-d3gbrpive8611514c-1348953433.tcloudbaseapp.com/cloud-admin/htmls/%E9%9A%90%E7%A7%81%E5%8D%8F%E8%AE%AE.html?sign=3626cb47334346612df3a4d34746e859&t=1779005613';
const MEMBER_PAGE_THEME: PageTheme = {
  headerColor: '#927239',
  headerFadeColor: '#F7F1E4',
  pageBackground: '#F7F5F0',
  accentColor: '#A78542',
  accentDeepColor: '#59451F',
  accentSoftColor: '#E7D5A5',
};

function buildPlanOption(plan: PlanView, index: number): ProductPlanOption {
  const periodLabel = plan.durationDays >= 365 ? '年' : plan.durationDays >= 90 ? '季' : '月';
  return {
    pid: plan.pid,
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
  useResetPageScroll();

  const [cachedUserInfo, setCachedUserInfo] = useState<CachedUserInfo | null>(null);
  const [data, setData] = useState<MemberHomeData>({
    membership: { status: 'none' },
    deliverySummary: { hasDeliveryInfo: false },
  });
  const [backendPlans, setBackendPlans] = useState<PlanView[]>([]);
  const [backendProductTypes, setBackendProductTypes] = useState<ProductTypeView[]>([]);
  const [productTypesLoading, setProductTypesLoading] = useState(true);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [activeProductCode, setActiveProductCode] = useState('ai_news');
  const [productTypeSheetVisible, setProductTypeSheetVisible] = useState(false);
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [productIntroVisible, setProductIntroVisible] = useState(false);
  const [introProductCode, setIntroProductCode] = useState('ai_news');
  const [aiAccountSheetVisible, setAiAccountSheetVisible] = useState(false);
  const [aiAccountSheetSource, setAiAccountSheetSource] = useState<AiAccountSheetSource>('purchase');
  const [aiAccountInfoVisible, setAiAccountInfoVisible] = useState(false);
  const [aiAccountInfo, setAiAccountInfo] = useState<AiAccountResult | null>(null);
  const [pendingProductCode, setPendingProductCode] = useState('ai_news');
  const [aiAccountName, setAiAccountName] = useState('');
  const [aiAccountPassword, setAiAccountPassword] = useState('');
  const [aiAccountErrors, setAiAccountErrors] = useState<AiAccountFormErrors>({});
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [purchaseAgreementAccepted, setPurchaseAgreementAccepted] = useState(false);
  const [usePointsDeduction, setUsePointsDeduction] = useState(false);
  const [messageReminderEnabled, setMessageReminderEnabled] = useState(false);
  const [memberLoading, setMemberLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<PendingAuthAction | null>(null);
  const [productComplianceMode, setProductComplianceMode] = useState<boolean | null>(null);

  useDidShow(() => {
    showTabBarSafely();
    openPromotedProductIfReady();
    void loadComplianceMode();
  });

  useEffect(() => {
    loadCachedUserInfo();
    void loadData();
    void loadProductTypes();
    void loadPlans();
    void loadComplianceMode();
  }, []);

  useEffect(() => {
    openPromotedProductIfReady();
  }, [productTypesLoading, backendProductTypes, productComplianceMode]);

  function openPromotedProductIfReady(): void {
    if (
      productComplianceMode === null
      || productTypesLoading
      || backendProductTypes.length === 0
    ) {
      return;
    }
    const promotedProductCode = consumePromotedProductCode();
    const promotedProduct = backendProductTypes.find(
      (item) => item.productCode === promotedProductCode,
    );
    if (
      !promotedProductCode
      || !promotedProduct
      || (productComplianceMode && !promotedProduct.complianceDisplay)
    ) {
      return;
    }
    setIntroProductCode(promotedProductCode);
    setProductTypeSheetVisible(false);
    setProductIntroVisible(true);
  }

  useEffect(() => {
    if (!paymentLocked) return;

    hideTabBarSafely();
    return () => {
      showTabBarSafely();
    };
  }, [paymentLocked]);

  useEffect(() => {
    if (data.membership.status !== 'active') return;
    const timer = setInterval(() => {
      setClockNow(Date.now());
    }, MINUTE_MS);
    return () => clearInterval(timer);
  }, [data.membership.status, data.membership.endAt]);

  function loadCachedUserInfo(): void {
    const cached = getCachedUserInfo();
    setCachedUserInfo(cached);
    if (cached?.userId && !cached.openId && !cached.openid) {
      void refreshCachedOpenId(cached);
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
      saveCachedUserInfo(nextInfo);
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

  async function loadComplianceMode(): Promise<void> {
    const config = await loadClientAppConfig();
    setProductComplianceMode(config.enableProductComplianceMode);
  }

  async function loadPlans(): Promise<void> {
    try {
      const result = await callCloudFunction<PlanListResult>('list-member-plans');
      setBackendPlans(result.plans);
      setSelectedPlanCode((prev) => prev || result.plans[0]?.planCode || '');
    } catch {
      setBackendPlans([]);
    } finally {
      setPlansLoaded(true);
    }
  }

  async function loadProductTypes(): Promise<void> {
    setProductTypesLoading(true);
    try {
      const result = await callCloudFunction<ProductTypeListResult>('list-product-types');
      setBackendProductTypes(result.productTypes);
    } catch {
      setBackendProductTypes([]);
    } finally {
      setProductTypesLoading(false);
    }
  }

  const isActive = data.membership.status === 'active';
  const isOpening = data.membership.status === 'opening';
  const memberStatusLabel = data.membership.status === 'none' ? '立即开通' : data.membership.openStatusLabel ?? '立即开通';
  const displayedMembership = productComplianceMode === true
    ? toCompliantMembership(data.membership, backendProductTypes, backendPlans)
    : data.membership;
  const planLabel = isActive || isOpening ? displayedMembership.planName ?? '会员套餐' : '普通会员';
  const remainCountdown = isActive
    ? formatRemainCountdown(data.membership.endAt, clockNow)
    : { value: String(data.membership.remainDays ?? 0), label: '剩余天数', remainMs: 0 };
  const renewAvailable = isActive && remainCountdown.remainMs > 0 && remainCountdown.remainMs <= 2 * DAY_MS;
  const membershipDurationMs = data.membership.startAt && data.membership.endAt
    ? Math.max(DAY_MS, data.membership.endAt - data.membership.startAt)
    : 30 * DAY_MS;
  const progress = Math.max(8, Math.min(100, isActive ? Math.round((remainCountdown.remainMs / membershipDurationMs) * 100) : 8));
  const expiryLabel = data.membership.status === 'none' ? '购买后开始计时' : isOpening ? '人工开通中' : formatDate(data.membership.endAt);
  const currentProductCode = data.membership.productCode ?? 'ai_news';
  const mobileBound = isMobileBound(data.userInfo?.mobile);
  const authConsentGranted = hasAuthConsent(cachedUserInfo);
  const nickname = data.userInfo?.nickname ?? cachedUserInfo?.nickname ?? '微信用户';
  const avatarUrl = data.userInfo?.avatarUrl ?? cachedUserInfo?.avatarUrl ?? '';
  const productTypes = useMemo(
    () => productComplianceMode === true
      ? backendProductTypes
          .map(toCompliantProductType)
          .filter((item): item is ProductTypeView => Boolean(item))
      : backendProductTypes,
    [backendProductTypes, productComplianceMode],
  );
  const membershipProduct = productTypes.find((item) => item.productCode === currentProductCode);
  const memberCardAvatarUrl = data.membership.status === 'none' ? avatarUrl : membershipProduct?.avatarUrl || avatarUrl;
  const activeProduct = productTypes.find((item) => item.productCode === activeProductCode);
  const introProduct = productTypes.find((item) => item.productCode === introProductCode);
  const plansByProduct = useMemo(() => {
    const nextMap: Record<string, ProductPlanOption[]> = {};
    backendPlans.forEach((rawPlan) => {
      const plan = productComplianceMode === true ? toCompliantPlan(rawPlan) : rawPlan;
      if (!plan) return;
      const current = nextMap[plan.productCode] ?? [];
      current.push(buildPlanOption(plan, current.length));
      nextMap[plan.productCode] = current;
    });
    return nextMap;
  }, [backendPlans, productComplianceMode]);
  const activePlans = plansByProduct[activeProductCode] ?? [];
  const activeProductAvailable = Boolean(activeProduct?.available && activePlans.some((plan) => plan.price > 0));
  const selectedPlan = activePlans.find((plan) => plan.planCode === selectedPlanCode) ?? activePlans[0];
  const pointsBalance = Math.max(0, Math.floor(data.userInfo?.pointsBalance ?? cachedUserInfo?.pointsBalance ?? 0));
  const maxPointsDeducted = selectedPlan ? Math.min(pointsBalance, Math.floor(selectedPlan.price)) : 0;
  const pointsDeductAmount = maxPointsDeducted;
  const finalPayAmount = selectedPlan ? Math.max(0, Number((selectedPlan.price - (usePointsDeduction ? pointsDeductAmount : 0)).toFixed(2))) : 0;
  const pointsDeductionAvailable = activeProductAvailable && maxPointsDeducted > 0;
  const aiAccountRegistered = Boolean(data.userInfo?.aiAccount?.registered || data.userInfo?.aiAccount?.email || cachedUserInfo?.aiAccountRegistered);
  const aiAccountEmailDomainAvailable = data.userInfo?.aiAccount?.emailDomainAvailable !== false;
  const aiAccountEmailSuffix = data.userInfo?.aiAccount?.emailDomain ?? DEFAULT_AI_ACCOUNT_EMAIL_SUFFIX;
  const aiAccountSheetDescription = !aiAccountEmailDomainAvailable
    ? '当前暂无可用邮箱域名，请联系管理员配置后再注册。'
    : aiAccountSheetSource === 'purchase'
      ? `请填写用于后台系统注册和交付的账号前缀，系统会自动拼接 ${aiAccountEmailSuffix}。注册成功后将继续选择套餐。`
      : `你还没有注册交付账号。请填写账号前缀，系统会自动拼接 ${aiAccountEmailSuffix}。`;
  const messageReminderAvailable = activeProductAvailable;

  function openPlanSheet(productCode: string): void {
    const nextProduct = productTypes.find((item) => item.productCode === productCode);
    if (!nextProduct) {
      Taro.showToast({ title: '商品信息加载失败，请刷新后重试', icon: 'none' });
      return;
    }
    const nextPlans = plansByProduct[nextProduct.productCode] ?? [];
    setActiveProductCode(nextProduct.productCode);
    setSelectedPlanCode(nextPlans[0]?.planCode ?? '');
    setPurchaseAgreementAccepted(false);
    setUsePointsDeduction(false);
    setMessageReminderEnabled(false);
    setPlanSheetVisible(true);
  }

  function openProductTypeSheet(): void {
    setProductTypeSheetVisible(true);
  }

  function closeProductTypeSheet(): void {
    setProductTypeSheetVisible(false);
  }

  function openProductIntro(productCode: string): void {
    if (!productTypes.some((item) => item.productCode === productCode)) {
      Taro.showToast({ title: '商品信息加载失败，请刷新后重试', icon: 'none' });
      return;
    }
    setIntroProductCode(productCode);
    setProductTypeSheetVisible(false);
    setProductIntroVisible(true);
  }

  function closeProductIntro(): void {
    setProductIntroVisible(false);
  }

  function closePlanSheet(): void {
    setPlanSheetVisible(false);
    setPurchaseAgreementAccepted(false);
    setUsePointsDeduction(false);
    setMessageReminderEnabled(false);
  }

  function openAgreement(url: string): void {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(url)}`,
    });
  }

  function hasLoggedInUser(): boolean {
    const cached = getCachedUserInfo() ?? cachedUserInfo;
    return hasAuthConsent(cached);
  }

  function requireAuth(action: PendingAuthAction): boolean {
    if (hasLoggedInUser()) {
      return true;
    }
    setPendingAuthAction(action);
    setAuthModalVisible(true);
    return false;
  }

  function handleAuthSuccess(info: AuthUserInfo): void {
    saveCachedUserInfo(info);
    setCachedUserInfo(info);
    setAuthModalVisible(false);
    void loadData();

    const action = pendingAuthAction;
    setPendingAuthAction(null);
    if (!action) {
      return;
    }
    if (action.type === 'subscribe') {
      openSubscriptionFlow(action.productCode);
      return;
    }
    if (action.type === 'saveAiAccount') {
      void handleSaveAiAccount();
    }
  }

  function openSubscriptionFlow(productCode: string): void {
    const product = productTypes.find((item) => item.productCode === productCode);
    if (!product?.available) {
      Taro.showToast({ title: product?.tag || '暂不支持购买', icon: 'none' });
      return;
    }
    if (!requireAuth({ type: 'subscribe', productCode })) {
      return;
    }
    setPendingProductCode(productCode);
    if (!aiAccountRegistered) {
      setAiAccountSheetSource('purchase');
      setAiAccountSheetVisible(true);
      return;
    }
    openPlanSheet(productCode);
  }

  function continueFromProductIntro(): void {
    if (!introProduct) {
      Taro.showToast({ title: '商品信息加载失败，请刷新后重试', icon: 'none' });
      return;
    }
    if (!introProduct.available) {
      Taro.showToast({ title: introProduct.tag || '暂不支持购买', icon: 'none' });
      return;
    }
    setProductIntroVisible(false);
    openSubscriptionFlow(introProduct.productCode);
  }

    async function handleSaveAiAccount(): Promise<void> {
    if (submitting) {
      return;
    }
    if (!requireAuth({ type: 'saveAiAccount' })) {
      return;
    }
    const validationErrors = validateAiAccountForm(aiAccountName, aiAccountPassword);
    if (!aiAccountEmailDomainAvailable) {
      validationErrors.submit = '当前暂无可用邮箱域名，请联系管理员配置后再注册';
    }
    setAiAccountErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = validationErrors.submit ?? validationErrors.accountName ?? validationErrors.password;
      if (firstError) {
        Taro.showToast({ title: firstError, icon: 'none' });
      }
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
      if (aiAccountSheetSource === 'purchase') {
        openPlanSheet(pendingProductCode);
      } else {
        Taro.showToast({ title: '账号注册成功', icon: 'success' });
        void loadData();
      }
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
    const current = getCachedUserInfo();
    if (!current?.userId && !cachedUserInfo?.userId) {
      return;
    }
    const nextInfo = {
      ...(current ?? cachedUserInfo),
      ...partial,
    } as CachedUserInfo;
    saveCachedUserInfo(nextInfo);
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

    const passwordError = password ? validateAiAccountPassword(password) : '请输入账号密码';
    if (passwordError) {
      errors.password = passwordError;
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
    if (!selectedPlan?.pid) {
      Taro.showToast({ title: '套餐缺少 pid，请联系管理员', icon: 'none' });
      throw new Error('套餐缺少 pid');
    }
    const latestPlans = await callCloudFunction<PlanListResult>('list-member-plans');
    setBackendPlans(latestPlans.plans);
    const latestActivePlans = latestPlans.plans.filter((plan) => plan.productCode === activeProductCode);
    if (!latestActivePlans.some((plan) => plan.pid === selectedPlan.pid)) {
      setSelectedPlanCode(latestActivePlans[0]?.planCode ?? '');
      Taro.showToast({ title: '套餐状态已更新，请重新选择', icon: 'none' });
      throw new Error('套餐状态已更新，请重新选择');
    }
    return callCloudFunction<CreateOrderResult>('create-order', {
      pid: selectedPlan.pid,
      usePointsDeduction,
    });
  }

  async function refreshPlansAfterUnavailablePlan(error: unknown): Promise<boolean> {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('首次购买')) {
      return false;
    }
    await loadPlans();
    Taro.showToast({ title: '套餐状态已更新，请重新选择', icon: 'none' });
    return true;
  }

  function togglePurchaseAgreement(): void {
    setPurchaseAgreementAccepted((accepted) => !accepted);
  }

  async function payOrder(orderNo: string, lockAlreadyEnabled = false): Promise<void> {
    if (!lockAlreadyEnabled) {
      setPaymentLocked(true);
    }
    try {
      const result = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(orderNo));
      if (result.paid || !result.payment && !result.virtualPayment) {
        await enableRenewReminderAfterPay();
        closePlanSheet();
        Taro.navigateTo({ url: `/pages/pay-result/index?orderNo=${orderNo}` });
        return;
      }
      try {
        await requestMiniProgramPayment(result);
        await enableRenewReminderAfterPay();
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

  async function enableRenewReminderAfterPay(): Promise<void> {
    if (data.subscribeMsgAuth || !messageReminderEnabled) {
      return;
    }
    try {
      const changed = await enableReminderSubscription({ source: 'afterPay' });
      if (changed) {
        setData((prev) => ({ ...prev, subscribeMsgAuth: true }));
      }
    } catch {
      // 支付已完成，提醒授权失败不影响跳转和订单状态。
    }
  }

  async function handleToggleReminder(): Promise<void> {
    try {
      const changed = data.subscribeMsgAuth
        ? await disableReminderSubscription()
        : await enableReminderSubscription();
      if (!changed) {
        return;
      }
      setData((prev) => ({ ...prev, subscribeMsgAuth: !prev.subscribeMsgAuth }));
      void loadData();
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message.slice(0, 18) : '消息提醒设置失败',
        icon: 'none',
      });
    }
  }

  async function handleTogglePlanReminder(): Promise<void> {
    if (data.subscribeMsgAuth) {
      Taro.showToast({ title: '消息提醒已开启', icon: 'none' });
      return;
    }
    if (messageReminderEnabled) {
      setMessageReminderEnabled(false);
      return;
    }

    try {
      const changed = await enableReminderSubscription({ source: 'afterPay' });
      if (!changed) {
        setMessageReminderEnabled(false);
        return;
      }
      setMessageReminderEnabled(true);
      setData((prev) => ({ ...prev, subscribeMsgAuth: true }));
    } catch (error) {
      setMessageReminderEnabled(false);
      Taro.showToast({
        title: error instanceof Error ? error.message.slice(0, 18) : '消息提醒设置失败',
        icon: 'none',
      });
    }
  }

  async function handlePlanPay(): Promise<void> {
    if (!activeProductAvailable) {
      Taro.showToast({ title: '该会员方案即将上线', icon: 'none' });
      return;
    }
    if (!requireAuth({ type: 'subscribe', productCode: activeProductCode })) {
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
    } catch (error) {
      const refreshed = await refreshPlansAfterUnavailablePlan(error);
      if (!refreshed) {
        Taro.showToast({ title: error instanceof Error ? error.message : '支付失败，请稍后再试', icon: 'none' });
      }
    } finally {
      setSubmitting(false);
      setPaymentLocked(false);
    }
  }

  async function handleGetPhoneNumber(event: WechatPhoneEvent): Promise<void> {
    if (!requireAuth({ type: 'subscribe', productCode: activeProductCode })) {
      return;
    }
    if (!purchaseAgreementAccepted) {
      Taro.showToast({ title: '请先阅读并同意协议', icon: 'none' });
      return;
    }
    const detail = event.detail;
    if (!detail?.code) {
      const errorMessage = detail?.errMsg || 'getPhoneNumber未返回code';
      console.error('member.getPhoneNumber.failed', { errorMessage, detail });
      Taro.showModal({
        title: '手机号授权失败',
        content: errorMessage,
        showCancel: false,
      });
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
      const refreshed = await refreshPlansAfterUnavailablePlan(error);
      if (!refreshed) {
        Taro.showToast({ title: error instanceof Error ? error.message : '授权失败，请稍后再试', icon: 'none' });
      }
    } finally {
      setSubmitting(false);
      setPaymentLocked(false);
    }
  }

  async function handleShowAiAccount(): Promise<void> {
    if (!aiAccountRegistered) {
      setAiAccountSheetSource('profile');
      setAiAccountSheetVisible(true);
      return;
    }

    try {
      Taro.showLoading({
        title: '加载中',
        mask: true,
      });
      const result = await callCloudFunction<AiAccountResult>('get-ai-account');
      Taro.hideLoading();
      setAiAccountInfo(result);
      setAiAccountInfoVisible(true);
    } catch (error) {
      Taro.hideLoading();
      const message = error instanceof Error ? error.message : '账号信息获取失败';
      if (message.includes('未注册') || message.includes('不存在') || message.includes('未填写')) {
        setAiAccountSheetSource('profile');
        setAiAccountSheetVisible(true);
        return;
      }
      Taro.showToast({ title: message, icon: 'none' });
    }
  }

  function closeAiAccountInfo(): void {
    setAiAccountInfoVisible(false);
    setAiAccountInfo(null);
  }

  async function copyAiAccountValue(value: string, label: ClipboardLabel): Promise<boolean> {
    return copyWithToast(value, label, {
      setClipboardData: async (data) => {
        await requirePrivacyAuthorization();
        await Taro.setClipboardData({ data });
      },
      hideToast: async () => {
        await Taro.hideToast();
      },
      showToast: async (title) => {
        await Taro.showToast({ title, icon: 'none', duration: 1600 });
      },
    });
  }

  async function handleShowLatestEmailCode(): Promise<void> {
    if (!aiAccountRegistered) {
      await Taro.showModal({
        title: '暂无验证码',
        content: '你还没有注册交付账号，暂无可查看的验证码。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }

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
        content: '暂未获取到最新登录验证码。请确认已在对应商品登录页重新发送验证邮件，然后稍等几秒后重试。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }

    if (isEmailCodeTooOld(result.receivedAt)) {
      const modalResult = await Taro.showModal({
        title: '获取验证码',
        content: `账号：\n${result.email}\n\n验证码还没收到，请稍等片刻`,
        confirmText: '刷新',
        cancelText: '关闭',
      });
      if (modalResult.confirm) {
        await handleShowLatestEmailCode();
      }
      return;
    }

    const modalResult = await Taro.showModal({
      title: '获取验证码',
      content: `账号：\n${result.email}\n\n验证码：\n${verificationCode}${result.expired ? '\n\n提示：这是最近一次未复制的验证码，可能已过期。如不可用，请在对应服务登录页重新发送。' : ''}`,
      confirmText: '复制',
      cancelText: '关闭',
    });
    if (!modalResult.confirm) {
      return;
    }

    const copied = await copyAiAccountValue(verificationCode, '验证码');
    if (!copied) {
      return;
    }
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
      theme={MEMBER_PAGE_THEME}
      onBack={() => {
        if (paymentLocked) {
          Taro.showToast({ title: '支付处理中，请勿返回', icon: 'none' });
        }
      }}
    >
      <View className='member-page'>
      <View className='saas-shell member-shell'>
        <View className='member-premium-card'>
          {memberLoading || productComplianceMode === null ? (
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
                  {memberCardAvatarUrl ? (
                    <Image className='member-profile__avatar-image' src={memberCardAvatarUrl} mode='aspectFill' />
                  ) : (
                    <Text>{nickname.slice(0, 1).toUpperCase()}</Text>
                  )}
                  <Text className='member-profile__ai'>AI</Text>
                </View>
                <View className='member-profile__copy'>
                  <Text
                    className={`member-plan-title__status member-plan-title__status--${renewAvailable ? 'none' : data.membership.status}`}
                    onClick={() => (data.membership.status === 'none' || renewAvailable) && openProductTypeSheet()}
                  >
                    {renewAvailable ? '立即续费' : memberStatusLabel}
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
                  <Text className='member-days__value'>{remainCountdown.value}</Text>
                  <Text className='member-days__label'>{remainCountdown.label}</Text>
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
          <Text className='member-section__title'>工具类型</Text>
          <View className='member-list-card'>
            {productTypesLoading || productComplianceMode === null ? (
              <View className='member-product-type-skeleton' aria-label='商品类型加载中'>
                {Array.from({ length: 2 }).map((_, index) => (
                  <Fragment key={index}>
                    {index > 0 ? <View className='member-divider' /> : null}
                    <View className='member-right-item member-product-type-skeleton__item'>
                      <View className='member-product-type__main'>
                        <Skeleton className='member-product-type-skeleton__avatar' width='64rpx' height='64rpx' />
                        <View className='member-product-type__copy'>
                          <Skeleton width={index === 0 ? '184rpx' : '156rpx'} height='32rpx' radius='10rpx' />
                          <Skeleton className='member-product-type-skeleton__desc' width='96rpx' height='24rpx' />
                        </View>
                      </View>
                      <Skeleton width='24rpx' height='36rpx' radius='8rpx' />
                    </View>
                  </Fragment>
                ))}
              </View>
            ) : productTypes.length > 0 ? (
              productTypes.map((product, index) => (
                <Fragment key={product.productCode}>
                  {index > 0 ? <View className='member-divider' /> : null}
                  <View
                    className={`member-right-item ${product.available ? '' : 'member-right-item--disabled'}`}
                    onClick={() => openProductIntro(product.productCode)}
                  >
                    <View className='member-product-type__main'>
                      {product.avatarUrl ? (
                        <Image className='member-product-type__avatar' src={product.avatarUrl} mode='aspectFill' />
                      ) : null}
                      <View className='member-product-type__copy'>
                        <Text className='member-right-item__title'>{product.label}</Text>
                        <Text className='member-right-item__desc'>
                          {product.productCode === currentProductCode && isActive ? '当前开通' : product.tag}
                        </Text>
                      </View>
                    </View>
                    <Image className='member-service-item__arrow' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
                  </View>
                </Fragment>
              ))
            ) : (
              <View className='member-right-item member-right-item--disabled'>
                <View>
                  <Text className='member-right-item__title'>暂无可购买商品</Text>
                  <Text className='member-right-item__desc'>请先初始化商品类型数据</Text>
                </View>
              </View>
            )}
          </View>
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
            <Button className='member-service-item member-service-item--contact' openType='contact'>
              <View className='member-service-item__icon'>
                <Image className='member-service-item__image' src={CUSTOMER_SUPPORT_ICON} mode='aspectFit' />
              </View>
              <View className='member-service-item__copy'>
                <Text className='member-service-item__title'>我的客服</Text>
                <Text className='member-service-item__desc'>24/7 智能与人工支持</Text>
              </View>
              <Image className='member-service-item__arrow' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
            </Button>
            <View className='member-divider' />
            <View className='member-service-item' onClick={() => void handleToggleReminder()}>
              <View className='member-service-item__icon'>
                <Image className='member-service-item__image' src={MESSAGE_REMINDER_ICON} mode='aspectFit' />
              </View>
              <View className='member-service-item__copy'>
                <Text className='member-service-item__title'>开启消息提醒</Text>
                <Text className='member-service-item__desc'>
                  {data.subscribeMsgAuth ? '已开启，开通成功和临近到期都会提醒' : '开通成功和临近到期都会提醒'}
                </Text>
              </View>
              <View className={`ios-switch ${data.subscribeMsgAuth ? 'ios-switch--on' : ''}`}>
                <Text className='ios-switch__thumb' />
              </View>
            </View>
          </View>
        </View>

        {/* <Button className='saas-button member-upgrade-button' onClick={() => openPlanSheet(currentProductCode)}>
          升级服务
        </Button> */}
      </View>

      <PopLayout visible={productTypeSheetVisible} onClose={closeProductTypeSheet} panelClassName='product-intro-sheet'>
        <View className='plan-sheet__head'>
          <View>
            <Text className='plan-sheet__label'>商品类型</Text>
            <Text className='plan-sheet__title'>选择开通商品</Text>
          </View>
          <Text className='plan-sheet__close' onClick={closeProductTypeSheet}>×</Text>
        </View>
        <Text className='plan-sheet__desc'>请选择要开通或续费的商品类型。</Text>
        <View className='product-type-sheet__list'>
          {productTypes.length > 0 ? (
            productTypes.map((product) => (
              <View
                key={product.productCode}
                className={`product-type-sheet__item ${product.available ? '' : 'product-type-sheet__item--disabled'}`}
                onClick={() => openProductIntro(product.productCode)}
              >
                <View className='product-type-sheet__main'>
                  {product.avatarUrl ? (
                    <Image className='product-type-sheet__avatar' src={product.avatarUrl} mode='aspectFill' />
                  ) : null}
                  <View className='product-type-sheet__copy'>
                    <Text className='product-type-sheet__title'>{product.label}</Text>
                    <Text className='product-type-sheet__desc'>{product.description}</Text>
                  </View>
                </View>
                <Text className='product-type-sheet__tag'>{product.tag}</Text>
              </View>
            ))
          ) : (
            <View className='product-type-sheet__item product-type-sheet__item--disabled'>
              <View>
                <Text className='product-type-sheet__title'>暂无可购买商品</Text>
                <Text className='product-type-sheet__desc'>请先部署并调用 seed-database 初始化商品类型。</Text>
              </View>
            </View>
          )}
        </View>
      </PopLayout>

      <PopLayout visible={productIntroVisible} onClose={closeProductIntro} panelClassName='product-intro-sheet'>
        <View className='plan-sheet__head'>
          <View>
            <Text className='plan-sheet__label'>商品介绍</Text>
            <Text className='plan-sheet__title'>{introProduct?.label ?? '商品信息'}</Text>
          </View>
          <Text className='plan-sheet__close' onClick={closeProductIntro}>×</Text>
        </View>
        <Text className='plan-sheet__desc'>{introProduct?.description ?? '暂未获取到商品信息，请刷新后重试。'}</Text>
        <View className='product-intro-list'>
          {(introProduct?.introHighlights ?? []).map((item) => (
            <View className='product-intro-item' key={item.title}>
              <Text className='product-intro-item__title'>{item.title}</Text>
              <Text className='product-intro-item__desc'>{item.description}</Text>
            </View>
          ))}
        </View>
        <Button
          className={`saas-button plan-sheet__button ${introProduct?.available ? '' : 'saas-button--disabled'}`}
          onClick={continueFromProductIntro}
        >
          {introProduct?.available ? '查看套餐' : introProduct?.tag ?? '暂不可用'}
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
        <Text className='plan-sheet__desc'>{aiAccountSheetDescription}</Text>
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
            <Text className='ai-account-field__suffix'>{aiAccountEmailDomainAvailable ? aiAccountEmailSuffix : '--'}</Text>
            {aiAccountErrors.accountName ? <Text className='ai-account-field__error'>{aiAccountErrors.accountName}</Text> : null}
          </View>
          <View className='ai-account-field'>
            <Text className='ai-account-field__label'>账号密码</Text>
            <Input
              className='ai-account-field__input'
              value={aiAccountPassword}
              placeholder={AI_ACCOUNT_PASSWORD_HINT}
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

      <PopLayout visible={aiAccountInfoVisible} onClose={closeAiAccountInfo} panelClassName='ai-account-info-sheet'>
        <View className='ai-account-info__head'>
          <View>
            <Text className='plan-sheet__label'>AI 账号信息</Text>
            <Text className='plan-sheet__title'>账号与密码</Text>
          </View>
          <Text className='plan-sheet__close' onClick={closeAiAccountInfo}>
            ×
          </Text>
        </View>
        <Text className='plan-sheet__desc'>账号和密码分开复制，方便直接登录或转发到电脑端使用。</Text>
        <View className='ai-account-info__list'>
          <View className='ai-account-info__item'>
            <View className='ai-account-info__row'>
              <View>
                <Text className='ai-account-info__label'>账号</Text>
                <Text className='ai-account-info__value'>{aiAccountInfo?.email ?? '--'}</Text>
              </View>
              <Button
                className='ai-account-info__copy'
                disabled={!aiAccountInfo?.email}
                onClick={() => {
                  if (!aiAccountInfo?.email) return;
                  void copyAiAccountValue(aiAccountInfo.email, '账号');
                }}
              >
                复制账号
              </Button>
            </View>
          </View>
          <View className='ai-account-info__item'>
            <View className='ai-account-info__row'>
              <View>
                <Text className='ai-account-info__label'>密码</Text>
                <Text className='ai-account-info__value ai-account-info__value--secret'>
                  {aiAccountInfo?.password ? maskSecret(aiAccountInfo.password) : '--'}
                </Text>
              </View>
              <Button
                className='ai-account-info__copy'
                disabled={!aiAccountInfo?.password}
                onClick={() => {
                  if (!aiAccountInfo?.password) return;
                  void copyAiAccountValue(aiAccountInfo.password, '密码');
                }}
              >
                复制密码
              </Button>
            </View>
          </View>
        </View>
      </PopLayout>

      <PopLayout visible={planSheetVisible} onClose={closePlanSheet} panelClassName='plan-sheet'>
            <View className='plan-sheet__head'>
              <View>
                <Text className='plan-sheet__label'>会员方案</Text>
                <Text className='plan-sheet__title'>{activeProduct?.label ?? '商品信息'}</Text>
              </View>
              <Text className='plan-sheet__close' onClick={closePlanSheet}>×</Text>
            </View>
            <Text className='plan-sheet__desc'>{activeProduct?.description ?? '暂未获取到商品信息，请刷新后重试。'}</Text>
            <View className='plan-sheet__plans'>
              {activePlans.length === 0 ? (
                <View className='plan-option plan-option--disabled'>
                  <View>
                    <Text className='plan-option__name'>{plansLoaded ? '暂无可购买套餐' : '套餐加载中'}</Text>
                    <Text className='plan-option__duration'>{plansLoaded ? '请稍后再试' : '正在同步云端套餐'}</Text>
                  </View>
                  <View className='plan-option__price-row'>
                    <Text className='plan-option__price'>--</Text>
                  </View>
                </View>
              ) : activePlans.map((plan) => {
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
            {messageReminderAvailable ? (
              <View className={`plan-sheet__subscribe ${data.subscribeMsgAuth || messageReminderEnabled ? 'plan-sheet__subscribe--active' : ''}`}>
                <View>
                  <View className='plan-sheet__subscribe-title-row'>
                    <Text className='plan-sheet__subscribe-title'>开启消息提醒</Text>
                    <Text className='plan-sheet__subscribe-badge'>{data.subscribeMsgAuth ? '已开启' : '推荐'}</Text>
                  </View>
                  <Text className='plan-sheet__subscribe-desc'>
                    {data.subscribeMsgAuth ? '开通完成和到期前 2 天都会通知你。' : '开通完成后通知你，会员到期前 2 天提醒续费。'}
                  </Text>
                </View>
                <View
                  className={`ios-switch ${data.subscribeMsgAuth || messageReminderEnabled ? 'ios-switch--on' : ''}`}
                  onClick={() => void handleTogglePlanReminder()}
                >
                  <Text className='ios-switch__thumb' />
                </View>
              </View>
            ) : null}
            <View className={`plan-sheet__points ${usePointsDeduction ? 'plan-sheet__points--active' : ''} ${pointsDeductionAvailable ? '' : 'plan-sheet__points--disabled'}`}>
              <View>
                <Text className='plan-sheet__points-title'>使用T币抵扣</Text>
                <Text className='plan-sheet__points-desc'>
                  {pointsDeductionAvailable
                    ? `可用 ${pointsBalance} T币，本次抵扣 ¥${pointsDeductAmount.toFixed(2)}`
                    : `可用 ${pointsBalance} T币，1 T币可抵 ¥1`}
                </Text>
                {selectedPlan ? (
                  <Text className='plan-sheet__points-pay'>预计支付 ¥{finalPayAmount.toFixed(2)}</Text>
                ) : null}
              </View>
              <View
                className={`ios-switch ${usePointsDeduction ? 'ios-switch--on' : ''}`}
                onClick={() => {
                  if (!pointsDeductionAvailable) {
                    Taro.showToast({ title: '暂无可抵扣T币', icon: 'none' });
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
                onClick={togglePurchaseAgreement}
              >
                {purchaseAgreementAccepted ? <Text className='plan-sheet__checkmark'>✓</Text> : null}
              </View>
              <Text className='plan-sheet__agreement-text' onClick={togglePurchaseAgreement}>我已阅读并同意</Text>
              <Text className='plan-sheet__link' onClick={() => openAgreement(USER_AGREEMENT_URL)}>《用户协议》</Text>
              <Text className='plan-sheet__link' onClick={() => openAgreement(PRIVACY_AGREEMENT_URL)}>《隐私政策》</Text>
            </View>
            {activeProductAvailable && !authConsentGranted ? (
              <Button
                className='saas-button plan-sheet__button'
                onClick={() => {
                  requireAuth({ type: 'subscribe', productCode: activeProductCode });
                }}
              >
                微信授权登录后继续
              </Button>
            ) : activeProductAvailable && !mobileBound ? (
              <Button
                className={`saas-button plan-sheet__button ${purchaseAgreementAccepted ? '' : 'saas-button--disabled'}`}
                openType={purchaseAgreementAccepted ? 'getPhoneNumber|agreePrivacyAuthorization' : undefined}
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
                {activeProductAvailable ? '确认支付' : plansLoaded ? '即将上线' : '套餐加载中'}
              </Button>
            )}
      </PopLayout>

      <AuthModal
        visible={authModalVisible}
        onAuthSuccess={handleAuthSuccess}
      />

      <PaymentLockOverlay visible={paymentLocked} />
      </View>
    </SaasPageFrame>
  );
}
