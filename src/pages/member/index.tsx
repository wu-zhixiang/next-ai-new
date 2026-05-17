import { useMemo, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { PopLayout } from '@/components/PopLayout';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { callCloudFunction } from '@/services/api';
import type { MembershipView, PlanView } from '@/types';
import { formatDate } from '@/utils/format';
import { isMobileBound } from '@/utils/mobile';
import { enableReminderSubscription } from '@/utils/subscription';

interface MemberHomeData {
  userInfo?: {
    mobile?: string;
    nickname?: string;
    avatarUrl?: string;
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
}

interface BindMobileResult {
  success: boolean;
  mobile?: string;
}

interface PayOrderResult {
  payment: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'MD5' | 'RSA';
    paySign: string;
  };
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
    code: 'openai_plus',
    label: 'Open AI资讯会员',
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
  openai_plus: [
    { planCode: 'annual', displayName: '年度会员', price: 0.01, priceLabel: '¥0.01', durationLabel: '365 天', periodLabel: '年', recommended: true },
    { planCode: 'quarterly', displayName: '季度会员', price: 0.01, priceLabel: '¥0.01', durationLabel: '90 天', periodLabel: '季' },
    { planCode: 'monthly', displayName: '月度会员', price: 0.01, priceLabel: '¥0.01', durationLabel: '30 天', periodLabel: '月' },
  ],
  claude_pro: [
    { planCode: 'claude_waitlist', displayName: 'Anthropic资讯会员', price: 0, priceLabel: '即将上线', durationLabel: '敬请期待' },
  ],
};

const ACCOUNT_INFO_ICON = require('../../assets/member/account-info.svg') as string;
const CUSTOMER_SUPPORT_ICON = require('../../assets/member/customer-support.svg') as string;

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
  const [data, setData] = useState<MemberHomeData>({
    membership: { status: 'none' },
    deliverySummary: { hasDeliveryInfo: false },
  });
  const [backendPlans, setBackendPlans] = useState<PlanView[]>([]);
  const [activeProductCode, setActiveProductCode] = useState('openai_plus');
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useDidShow(() => {
    void loadData();
    void loadPlans();
  });

  async function loadData(): Promise<void> {
    const result = await callCloudFunction<MemberHomeData>('get-member-home');
    setData(result);
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
  const memberStatusLabel = data.membership.openStatusLabel ?? '立即开通';
  const planLabel = data.membership.planName ?? 'Open AI资讯会员';
  const remainDays = data.membership.remainDays ?? 0;
  const progress = Math.max(8, Math.min(100, isActive ? Math.round((remainDays / 30) * 100) : 8));
  const expiryLabel = data.membership.status === 'none' ? '购买后开始计时' : formatDate(data.membership.endAt);
  const currentProductCode = data.membership.productCode ?? 'openai_plus';
  const mobileBound = isMobileBound(data.userInfo?.mobile);
  const nickname = data.userInfo?.nickname ?? 'Alex Thompson';
  const activeProduct = PRODUCT_OPTIONS.find((item) => item.code === activeProductCode) ?? PRODUCT_OPTIONS[0];
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

  function openPlanSheet(productCode: string): void {
    const nextProduct = PRODUCT_OPTIONS.find((item) => item.code === productCode) ?? PRODUCT_OPTIONS[0];
    const nextPlans = plansByProduct[nextProduct.code] ?? FALLBACK_PLAN_MAP[nextProduct.code] ?? [];
    setActiveProductCode(nextProduct.code);
    setSelectedPlanCode(nextPlans[0]?.planCode ?? '');
    setPlanSheetVisible(true);
  }

  async function createOrder(): Promise<CreateOrderResult> {
    if (!selectedPlanCode) {
      Taro.showToast({ title: '请选择会员方案', icon: 'none' });
      throw new Error('未选择会员方案');
    }
    return callCloudFunction<CreateOrderResult>('create-order', { planCode: selectedPlanCode });
  }

  async function payOrder(orderNo: string): Promise<void> {
    const result = await callCloudFunction<PayOrderResult>('pay-order', { orderNo });
    try {
      await Taro.requestPayment({ ...result.payment });
    } finally {
      setPlanSheetVisible(false);
      Taro.navigateTo({ url: `/pages/pay-result/index?orderNo=${orderNo}` });
    }
  }

  async function handlePlanPay(): Promise<void> {
    if (!activeProductAvailable) {
      Taro.showToast({ title: '该会员方案即将上线', icon: 'none' });
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const profile = await callCloudFunction<ProfileResult>('get-profile');
      if (!isMobileBound(profile.mobile)) {
        Taro.showToast({ title: '请先授权微信手机号', icon: 'none' });
        return;
      }
      const order = await createOrder();
      await payOrder(order.orderNo);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGetPhoneNumber(event: WechatPhoneEvent): Promise<void> {
    const detail = event.detail;
    if (!detail?.code) {
      Taro.showToast({ title: detail?.errMsg?.includes('deny') ? '你已取消手机号授权' : '未获取到手机号授权', icon: 'none' });
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const bindResult = await callCloudFunction<BindMobileResult>('bind-mobile', {
        source: 'wechat_phone',
        code: detail.code,
        encryptedData: detail.encryptedData,
        iv: detail.iv,
      });
      setData((prev) => ({ ...prev, userInfo: { ...prev.userInfo, mobile: bindResult.mobile } }));
      const order = await createOrder();
      await payOrder(order.orderNo);
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '授权失败，请稍后再试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SaasPageFrame title='会员中心' showBack={false}>
      <View className='member-page'>
      <View className='saas-shell member-shell'>
        <View className='member-premium-card'>
          <View className='member-profile'>
            <View className='member-profile__avatar'>
              <Text>{nickname.slice(0, 1).toUpperCase()}</Text>
              <Text className='member-profile__ai'>AI</Text>
            </View>
            <View className='member-profile__copy'>
              <Text className='member-profile__name'>{nickname}</Text>
              <Text className={`member-plan-title__status member-plan-title__status--${data.membership.status}`}>
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
        </View>

        <View className='member-section'>
          <Text className='member-section__title'>服务与支持</Text>
          <View className='member-list-card'>
            <View className='member-service-item'>
              <View className='member-service-item__icon'>
                <Image className='member-service-item__image' src={ACCOUNT_INFO_ICON} mode='aspectFit' />
              </View>
              <View className='member-service-item__copy'>
                <Text className='member-service-item__title'>账号信息</Text>
                <Text className='member-service-item__desc'>管理您的账号与安全</Text>
              </View>
              <Text className='member-service-item__arrow'>›</Text>
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
              <Text className='member-service-item__arrow'>›</Text>
            </View>
          </View>
        </View>

        <View className='member-section'>
          <Text className='member-section__title'>我的权益</Text>
          <View className='member-list-card'>
            {PRODUCT_OPTIONS.map((product) => (
              <View key={product.code} className='member-right-item' onClick={() => openPlanSheet(product.code)}>
                <View>
                  <Text className='member-right-item__title'>{product.label}</Text>
                  <Text className='member-right-item__desc'>{product.code === currentProductCode && isActive ? '当前开通' : product.tag}</Text>
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

      <PopLayout visible={planSheetVisible} onClose={() => setPlanSheetVisible(false)} panelClassName='plan-sheet'>
            <View className='plan-sheet__head'>
              <View>
                <Text className='plan-sheet__label'>会员方案</Text>
                <Text className='plan-sheet__title'>{activeProduct.label}</Text>
              </View>
              <Text className='plan-sheet__close' onClick={() => setPlanSheetVisible(false)}>×</Text>
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
            {activeProductAvailable && !mobileBound ? (
              <Button className='saas-button plan-sheet__button' openType='getPhoneNumber' loading={submitting} onGetPhoneNumber={handleGetPhoneNumber}>
                授权手机号并支付
              </Button>
            ) : (
              <Button className={`saas-button plan-sheet__button ${activeProductAvailable ? '' : 'saas-button--disabled'}`} loading={submitting} onClick={() => void handlePlanPay()}>
                {activeProductAvailable ? '确认支付' : '即将上线'}
              </Button>
            )}
      </PopLayout>

      </View>
    </SaasPageFrame>
  );
}
