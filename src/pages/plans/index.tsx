import { useEffect, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { callCloudFunction } from '@/services/api';
import type { PlanView } from '@/types';
import { isMobileBound } from '@/utils/mobile';
import { createPayOrderPayload, requestMiniProgramPayment, type PayOrderResult } from '@/utils/payment';

interface PlanListResult {
  plans: PlanView[];
}

interface CreateOrderResult {
  orderNo: string;
}

interface ProfileResult {
  mobile?: string;
  mobileBound?: boolean;
}

interface BindMobileResult {
  success: boolean;
  mobile?: string;
}

interface WechatPhoneEventDetail {
  code?: string;
  encryptedData?: string;
  iv?: string;
  errMsg?: string;
}

interface WechatPhoneEvent {
  detail?: WechatPhoneEventDetail;
}

interface MockPlan {
  productCode: string;
  planCode: string;
  planName: string;
  displayName: string;
  price: number;
  originalPrice?: number;
  periodLabel: string;
  durationDays: number;
  isBestValue?: boolean;
}

const MOCK_PLANS: MockPlan[] = [
  {
    productCode: 'ai_news',
    planCode: 'plus',
    planName: 'AI资讯PLUS会员',
    displayName: 'AI资讯PLUS会员',
    price: 0.01,
    periodLabel: '月',
    durationDays: 30,
    isBestValue: true,
  },
  {
    productCode: 'ai_news',
    planCode: 'go',
    planName: 'AI资讯GO会员',
    displayName: 'AI资讯GO会员',
    price: 0.01,
    periodLabel: '月',
    durationDays: 30,
  },
];

export default function PlansPage(): JSX.Element {
  const router = useRouter();
  const [backendPlans, setBackendPlans] = useState<PlanView[]>([]);
  const productCode = router.params.product ?? 'ai_news';
  const visiblePlans = MOCK_PLANS.filter((plan) => plan.productCode === productCode);
  const defaultPlanCode = router.params.planCode && visiblePlans.some((plan) => plan.planCode === router.params.planCode)
    ? router.params.planCode
    : visiblePlans[0]?.planCode ?? MOCK_PLANS[0].planCode;
  const [selectedPlanCode, setSelectedPlanCode] = useState(defaultPlanCode);
  const [mobileBound, setMobileBound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadPlans();
    void loadProfile();
    setSelectedPlanCode(defaultPlanCode);
  }, []);

  async function loadPlans(): Promise<void> {
    try {
      const data = await callCloudFunction<PlanListResult>('list-member-plans');
      setBackendPlans(data.plans);
    } catch {
      setBackendPlans([]);
    }
  }

  async function loadProfile(): Promise<void> {
    try {
      const profile = await callCloudFunction<ProfileResult>('get-profile');
      setMobileBound(isMobileBound(profile.mobile));
    } catch {
      setMobileBound(false);
    }
  }

  async function createOrder(): Promise<void> {
    if (!selectedPlanCode) {
      Taro.showToast({ title: '请选择套餐', icon: 'none' });
      return;
    }

    const selectedIndex = visiblePlans.findIndex((plan) => plan.planCode === selectedPlanCode);
    const mappedPlanCode = backendPlans[selectedIndex]?.planCode ?? selectedPlanCode;

    const result = await callCloudFunction<CreateOrderResult>('create-order', {
      planCode: mappedPlanCode,
    });

    const payResult = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(result.orderNo));
    if (payResult.paid || !payResult.payment && !payResult.virtualPayment) {
      Taro.navigateTo({
        url: `/pages/pay-result/index?orderNo=${result.orderNo}`,
      });
      return;
    }
    try {
      await requestMiniProgramPayment(payResult);
    } finally {
      Taro.navigateTo({
        url: `/pages/pay-result/index?orderNo=${result.orderNo}`,
      });
    }
  }

  async function handleCreateOrder(): Promise<void> {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const profile = await callCloudFunction<ProfileResult>('get-profile');
      if (!isMobileBound(profile.mobile)) {
        setMobileBound(false);
        Taro.showToast({ title: '请先授权微信手机号', icon: 'none' });
        return;
      }

      setMobileBound(true);
      await createOrder();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGetPhoneNumber(event: WechatPhoneEvent): Promise<void> {
    const detail = event.detail;
    if (!detail || !detail.code) {
      Taro.showToast({
        title: detail?.errMsg?.includes('deny') ? '你已取消手机号授权' : '未获取到手机号授权',
        icon: 'none',
      });
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await callCloudFunction<BindMobileResult>('bind-mobile', {
        source: 'wechat_phone',
        code: detail.code,
        encryptedData: detail.encryptedData,
        iv: detail.iv,
      });

      setMobileBound(isMobileBound(result.mobile));
      await createOrder();
    } catch (error) {
      const message = error instanceof Error ? error.message : '授权失败，请稍后再试';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className='page plans-page'>
      <AppTransparentHeader title='会员套餐' />
      <View className='plans-body'>

        <View className='plans-list'>
          {visiblePlans.map((plan) => {
            const selected = plan.planCode === selectedPlanCode;

            return (
              <View
                key={plan.planCode}
                className={`plans-card ${selected ? 'plans-card--selected' : ''}`}
                onClick={() => setSelectedPlanCode(plan.planCode)}
              >
                {plan.isBestValue ? (
                  <View className='plans-badge'>
                    推荐
                  </View>
                ) : null}

                <View className='plans-card__overlay' />
                <View className='plans-card__content'>
                  <View className='plans-card__copy'>
                    <Text className={`plans-card__name ${selected ? 'plans-card__name--selected' : ''}`}>{plan.displayName}</Text>
                    {plan.originalPrice ? <Text className='plans-card__strike'>¥ {plan.originalPrice}.00</Text> : null}
                    <View className='plans-card__price-row'>
                      <Text className={`plans-card__price ${selected ? 'plans-card__price--selected' : ''}`}>¥{plan.price.toFixed(2)}</Text>
                      <Text className='plans-card__period'>/ {plan.periodLabel}</Text>
                    </View>
                  </View>

                  <View className={`plans-radio ${selected ? 'plans-radio--selected' : ''}`}>
                    <View className={`plans-radio__dot ${selected ? 'plans-radio__dot--selected' : ''}`} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View className='plans-notes'>
          <Text className='plans-notes__label'>购买说明</Text>
          <Text className='plans-notes__item'>
            1. 支付成功后，会员时长立即生效。
          </Text>
          <Text className='plans-notes__item'>
            2. 已有会员续费时，将在原到期时间基础上顺延。
          </Text>
        </View>

        <View className='plans-footer-cta'>
          <View className='plans-footer-cta__mask'>
            {mobileBound ? (
              <Button className='plans-primary-button' loading={submitting} onClick={() => void handleCreateOrder()}>
                <Text>确认套餐并去支付</Text>
                <Text className='plans-primary-button__icon'>→</Text>
              </Button>
            ) : (
              <Button className='plans-primary-button' openType='getPhoneNumber' loading={submitting} onGetPhoneNumber={handleGetPhoneNumber}>
                <Text>授权手机号并支付</Text>
                <Text className='plans-primary-button__icon'>→</Text>
              </Button>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
