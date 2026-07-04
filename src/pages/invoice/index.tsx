import { useEffect, useMemo, useState } from 'react';
import { Input, Text, View } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { callCloudFunction } from '@/services/api';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { InvoiceOrderView, InvoiceProfileView, InvoiceRequestView } from '@/types';

interface InvoiceListResult {
  availableOrders: InvoiceOrderView[];
  invoiceRequests: InvoiceRequestView[];
  invoiceProfile?: InvoiceProfileView | null;
}

interface SubmitInvoiceResult {
  invoiceNo: string;
  status: InvoiceRequestView['status'];
}

type InvoiceTab = 'pending' | 'processing' | 'completed';

const STATUS_LABEL: Record<InvoiceRequestView['status'], string> = {
  submitted: '已受理',
  processing: '开票中',
  issued: '已完成',
  failed: '开票失败',
  rejected: '已驳回',
};

const TAB_LABEL: Record<InvoiceTab, string> = {
  pending: '可开票',
  processing: '开票中',
  completed: '已完成',
};

function isProcessingInvoice(item: InvoiceRequestView): boolean {
  return item.status === 'submitted' || item.status === 'processing';
}

function isCompletedInvoice(item: InvoiceRequestView): boolean {
  return item.status === 'issued' || item.status === 'failed' || item.status === 'rejected';
}

export default function InvoicePage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<InvoiceOrderView[]>([]);
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceRequestView[]>([]);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('pending');
  const [selectedOrderNos, setSelectedOrderNos] = useState<string[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [titleType, setTitleType] = useState<'personal' | 'company'>('personal');
  const [title, setTitle] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    void loadInvoiceData();
  }, []);

  usePullDownRefresh(() => {
    void refreshInvoiceData();
  });

  const processingInvoices = useMemo(
    () => invoiceRequests.filter(isProcessingInvoice),
    [invoiceRequests],
  );
  const completedInvoices = useMemo(
    () => invoiceRequests.filter(isCompletedInvoice),
    [invoiceRequests],
  );
  const selectedOrders = useMemo(
    () => availableOrders.filter((order) => selectedOrderNos.includes(order.orderNo)),
    [availableOrders, selectedOrderNos],
  );
  const selectedAmount = useMemo(
    () => selectedOrders.reduce((sum, order) => sum + order.amount, 0),
    [selectedOrders],
  );

  async function loadInvoiceData(showLoading = true): Promise<void> {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await callCloudFunction<InvoiceListResult>('list-invoice-orders');
      setAvailableOrders(result.availableOrders);
      setInvoiceRequests(result.invoiceRequests);
      setSelectedOrderNos((current) => current.filter((orderNo) => (
        result.availableOrders.some((order) => order.orderNo === orderNo)
      )));
      hydrateInvoiceProfile(result.invoiceProfile);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '发票信息加载失败',
        icon: 'none',
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  function hydrateInvoiceProfile(profile?: InvoiceProfileView | null): void {
    if (!profile) {
      return;
    }
    setTitleType(profile.titleType === 'company' ? 'company' : 'personal');
    setTitle(profile.title ?? '');
    setTaxNo(profile.taxNo ?? '');
    setEmail(profile.email ?? '');
  }

  async function refreshInvoiceData(): Promise<void> {
    try {
      await loadInvoiceData(false);
    } finally {
      Taro.stopPullDownRefresh();
    }
  }

  function toggleOrder(orderNo: string): void {
    setSelectedOrderNos((current) => (
      current.includes(orderNo)
        ? current.filter((item) => item !== orderNo)
        : [...current, orderNo]
    ));
  }

  function openInvoiceForm(): void {
    if (selectedOrderNos.length === 0) {
      Taro.showToast({ title: '请选择需要开票的订单', icon: 'none' });
      return;
    }
    setFormVisible(true);
  }

  function closeInvoiceForm(): void {
    setFormVisible(false);
  }

  function validateForm(): string {
    if (selectedOrderNos.length === 0) {
      return '请选择需要开票的订单';
    }
    if (!title.trim()) {
      return '请填写发票抬头';
    }
    if (titleType === 'company' && !taxNo.trim()) {
      return '企业发票请填写纳税人识别号';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return '请填写正确的接收邮箱';
    }
    return '';
  }

  async function submitInvoiceRequest(): Promise<void> {
    if (submitting) return;
    const message = validateForm();
    if (message) {
      Taro.showToast({ title: message, icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await callCloudFunction<SubmitInvoiceResult>('submit-invoice-request', {
        orderNos: selectedOrderNos,
        titleType,
        title: title.trim(),
        taxNo: taxNo.trim(),
        email: email.trim(),
      });
      Taro.showToast({ title: '开票申请已受理', icon: 'none' });
      setSelectedOrderNos([]);
      setFormVisible(false);
      setActiveTab('processing');
      await loadInvoiceData(false);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '提交失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function renderOrderCard(order: InvoiceOrderView): JSX.Element {
    const selected = selectedOrderNos.includes(order.orderNo);
    return (
      <View
        key={order.orderNo}
        className={`invoice-order-card ${selected ? 'invoice-order-card--selected' : ''}`}
        onClick={() => toggleOrder(order.orderNo)}
      >
        <View className='invoice-order-card__main'>
          <Text className='invoice-order-card__title'>{order.productName}</Text>
          <Text className='invoice-order-card__desc'>{order.planName} · {formatDateTime(order.paidAt)}</Text>
          <Text className='invoice-order-card__no'>{order.orderNo}</Text>
        </View>
        <View className='invoice-order-card__side'>
          <Text className='invoice-order-card__amount'>{formatPrice(order.amount)}</Text>
          <View className={`invoice-check ${selected ? 'invoice-check--on' : ''}`}>
            <Text>{selected ? '✓' : ''}</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderInvoiceCard(item: InvoiceRequestView): JSX.Element {
    return (
      <View key={item.invoiceNo} className='invoice-history-card'>
        <View className='invoice-history-card__head'>
          <View>
            <Text className='invoice-history-card__title'>{item.title}</Text>
            <Text className='invoice-history-card__desc'>{item.invoiceNo}</Text>
          </View>
          <Text className={`invoice-status invoice-status--${item.status}`}>{STATUS_LABEL[item.status]}</Text>
        </View>
        <View className='invoice-history-card__rows'>
          <View className='info-row'>
            <Text className='info-row__label'>开票金额</Text>
            <Text className='info-row__value'>{formatPrice(item.amount)}</Text>
          </View>
          <View className='info-row'>
            <Text className='info-row__label'>接收邮箱</Text>
            <Text className='info-row__value'>{item.email}</Text>
          </View>
          <View className='info-row'>
            <Text className='info-row__label'>提交时间</Text>
            <Text className='info-row__value'>{formatDateTime(item.createdAt)}</Text>
          </View>
          {item.status === 'issued' ? (
            <View className='info-row'>
              <Text className='info-row__label'>发送状态</Text>
              <Text className='info-row__value'>已发送到邮箱</Text>
            </View>
          ) : null}
          {item.rejectReason ? (
            <View className='info-row'>
              <Text className='info-row__label'>驳回原因</Text>
              <Text className='info-row__value'>{item.rejectReason}</Text>
            </View>
          ) : null}
          {item.failReason ? (
            <View className='info-row'>
              <Text className='info-row__label'>失败原因</Text>
              <Text className='info-row__value'>{item.failReason}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function renderListContent(): JSX.Element {
    if (loading) {
      return <View className='invoice-empty'>加载中...</View>;
    }
    if (activeTab === 'pending') {
      return availableOrders.length === 0 ? (
        <View className='invoice-empty'>
          <Text className='invoice-empty__title'>暂无待开票订单</Text>
          <Text className='invoice-empty__desc'>已支付并完成开通的订单会展示在这里</Text>
        </View>
      ) : (
        <>
          <View>{availableOrders.map(renderOrderCard)}</View>
          <View className='invoice-bottom-action'>
            <View>
              <Text className='invoice-bottom-action__label'>已选 {selectedOrderNos.length} 个订单</Text>
              <Text className='invoice-bottom-action__amount'>{formatPrice(selectedAmount)}</Text>
            </View>
            <View
              className={`invoice-bottom-action__button ${selectedOrderNos.length === 0 ? 'invoice-bottom-action__button--disabled' : ''}`}
              onClick={openInvoiceForm}
            >
              <Text>开发票</Text>
            </View>
          </View>
        </>
      );
    }
    if (activeTab === 'processing') {
      return processingInvoices.length === 0 ? (
        <View className='invoice-empty'>
          <Text className='invoice-empty__title'>暂无开票中记录</Text>
        </View>
      ) : (
        <View>{processingInvoices.map(renderInvoiceCard)}</View>
      );
    }
    return completedInvoices.length === 0 ? (
      <View className='invoice-empty'>
        <Text className='invoice-empty__title'>暂无已完成记录</Text>
      </View>
    ) : (
      <View>{completedInvoices.map(renderInvoiceCard)}</View>
    );
  }

  function renderInvoiceForm(): JSX.Element {
    return (
      <>
        <View className='invoice-summary-card'>
          <View>
            <Text className='invoice-summary-card__label'>开票订单</Text>
            <Text className='invoice-summary-card__value'>{selectedOrders.length} 个</Text>
          </View>
          <View>
            <Text className='invoice-summary-card__label'>开票金额</Text>
            <Text className='invoice-summary-card__value'>{formatPrice(selectedAmount)}</Text>
          </View>
        </View>

        <View className='invoice-section'>
          <View className='invoice-section__head'>
            <Text className='invoice-section__title'>发票信息</Text>
            <Text className='invoice-section__link' onClick={closeInvoiceForm}>返回列表</Text>
          </View>
          <View className='invoice-form-card'>
            <View className='invoice-type-switch'>
              <View className={`invoice-type-switch__item ${titleType === 'personal' ? 'invoice-type-switch__item--active' : ''}`} onClick={() => setTitleType('personal')}>
                <Text>个人</Text>
              </View>
              <View className={`invoice-type-switch__item ${titleType === 'company' ? 'invoice-type-switch__item--active' : ''}`} onClick={() => setTitleType('company')}>
                <Text>企业</Text>
              </View>
            </View>
            <View className='invoice-field'>
              <Text className='invoice-field__label'>发票抬头</Text>
              <Input value={title} placeholder='请输入发票抬头' onInput={(event) => setTitle(event.detail.value)} />
            </View>
            {titleType === 'company' ? (
              <View className='invoice-field'>
                <Text className='invoice-field__label'>纳税人识别号</Text>
                <Input value={taxNo} placeholder='请输入企业税号' onInput={(event) => setTaxNo(event.detail.value)} />
              </View>
            ) : null}
            <View className='invoice-field'>
              <Text className='invoice-field__label'>接收邮箱</Text>
              <Input value={email} placeholder='example@company.com' type='text' onInput={(event) => setEmail(event.detail.value)} />
            </View>
            <View className={`invoice-submit ${submitting ? 'invoice-submit--disabled' : ''}`} onClick={() => void submitInvoiceRequest()}>
              <Text>{submitting ? '提交中...' : '申请电子发票'}</Text>
            </View>
          </View>
        </View>
      </>
    );
  }

  return (
    <SaasPageFrame title='开发票'>
      <View className='invoice-page'>
        <View className='saas-shell invoice-shell'>
          {formVisible ? renderInvoiceForm() : (
            <>
              <View className='invoice-tabs'>
                {(['pending', 'processing', 'completed'] as InvoiceTab[]).map((tab) => (
                  <View
                    key={tab}
                    className={`invoice-tabs__item ${activeTab === tab ? 'invoice-tabs__item--active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    <Text>{TAB_LABEL[tab]}</Text>
                  </View>
                ))}
              </View>

              <View className='invoice-section'>
                <Text className='invoice-section__hint'>提交后由运营人工开具电子发票，完成后可在这里查看发票信息。</Text>
                {renderListContent()}
              </View>
            </>
          )}
        </View>
      </View>
    </SaasPageFrame>
  );
}
