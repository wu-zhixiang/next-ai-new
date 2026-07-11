import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { useAdminApi } from '../../hooks/useAdminApi';
import type { MemberPlanInput, MemberPlanRecord, PlanComplianceDisplay, ProductStatus, ProductTypeRecord } from '../../types/admin';

interface MemberPlanFormState {
  readonly productCode: string;
  readonly productName: string;
  readonly planCode: string;
  readonly planName: string;
  readonly virtualPaymentProductId: string;
  readonly price: string;
  readonly totalAiPoints: string;
  readonly durationDays: string;
  readonly autoRenewEnabled: boolean;
  readonly complianceEnabled: boolean;
  readonly status: ProductStatus;
  readonly sort: string;
  readonly description: string;
  readonly complianceDisplay: PlanComplianceDisplay;
}

const emptyComplianceDisplay: PlanComplianceDisplay = {
  productName: '',
  planName: '',
  description: '',
};

function createEmptyForm(): MemberPlanFormState {
  return {
    productCode: '',
    productName: '',
    planCode: '',
    planName: '',
    virtualPaymentProductId: '',
    price: '0',
    totalAiPoints: '0',
    durationDays: '30',
    autoRenewEnabled: false,
    complianceEnabled: false,
    status: 'off',
    sort: '999',
    description: '',
    complianceDisplay: emptyComplianceDisplay,
  };
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function createFormFromPlan(plan: MemberPlanRecord): MemberPlanFormState {
  return {
    productCode: safeString(plan.productCode),
    productName: safeString(plan.productName),
    planCode: safeString(plan.planCode),
    planName: safeString(plan.planName),
    virtualPaymentProductId: safeString(plan.virtualPaymentProductId),
    price: String(Number.isFinite(plan.price) ? plan.price : 0),
    totalAiPoints: String(Number.isFinite(plan.totalAiPoints) ? plan.totalAiPoints : 0),
    durationDays: String(Number.isFinite(plan.durationDays) ? plan.durationDays : 30),
    autoRenewEnabled: plan.autoRenewEnabled,
    complianceEnabled: plan.complianceEnabled === true,
    status: plan.status,
    sort: String(Number.isFinite(plan.sort) ? plan.sort : 999),
    description: safeString(plan.description),
    complianceDisplay: {
      productName: safeString(plan.complianceDisplay?.productName),
      planName: safeString(plan.complianceDisplay?.planName),
      description: safeString(plan.complianceDisplay?.description),
    },
  };
}

function findPlan(plans: readonly MemberPlanRecord[], planId: string): MemberPlanRecord | undefined {
  return plans.find((plan) => plan.id === planId || plan.pid === planId);
}

function buildOptionalComplianceDisplay(value: PlanComplianceDisplay): PlanComplianceDisplay | undefined {
  const nextValue: PlanComplianceDisplay = {
    productName: value.productName.trim(),
    planName: value.planName.trim(),
    description: value.description?.trim() || '',
  };
  return nextValue.productName || nextValue.planName || nextValue.description ? nextValue : undefined;
}

function buildPlanInput(form: MemberPlanFormState): MemberPlanInput {
  const price = Number.parseInt(form.price, 10);
  const totalAiPoints = Number.parseInt(form.totalAiPoints, 10);
  const durationDays = Number.parseInt(form.durationDays, 10);
  const sort = Number.parseInt(form.sort, 10);
  const complianceDisplay = form.complianceEnabled ? buildOptionalComplianceDisplay(form.complianceDisplay) : undefined;
  return {
    productCode: form.productCode.trim(),
    productName: form.productName.trim(),
    planCode: form.planCode.trim(),
    planName: form.planName.trim(),
    virtualPaymentProductId: form.virtualPaymentProductId.trim(),
    price: Number.isFinite(price) ? price : 0,
    totalAiPoints: Number.isFinite(totalAiPoints) ? Math.max(0, totalAiPoints) : 0,
    durationDays: Number.isFinite(durationDays) ? durationDays : 30,
    autoRenewEnabled: form.autoRenewEnabled,
    complianceEnabled: form.complianceEnabled,
    status: form.status,
    sort: Number.isFinite(sort) ? sort : 999,
    description: form.description.trim(),
    ...(complianceDisplay ? { complianceDisplay } : {}),
  };
}

export function MemberPlanEditPage(): JSX.Element {
  const api = useAdminApi();
  const navigate = useNavigate();
  const { planId = '' } = useParams();
  const isNew = !planId;
  const [form, setForm] = useState<MemberPlanFormState>(createEmptyForm);
  const [productOptions, setProductOptions] = useState<readonly ProductTypeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pageTitle = useMemo(() => (isNew ? '新增套餐' : `编辑 ${form.planName || '套餐'}`), [form.planName, isNew]);

  const loadProductOptions = useCallback(async (): Promise<void> => {
    try {
      setProductOptions(await api.listProductTypes());
    } catch {
      setProductOptions([]);
    }
  }, [api]);

  const loadPlan = useCallback(async (): Promise<void> => {
    if (isNew) {
      setForm(createEmptyForm());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const plans = await api.listPlans();
      const target = findPlan(plans, planId);
      if (!target) {
        throw new Error('套餐不存在');
      }
      setForm(createFormFromPlan(target));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '套餐读取失败');
    } finally {
      setIsLoading(false);
    }
  }, [api, isNew, planId]);

  useEffect(() => {
    void loadProductOptions();
  }, [loadProductOptions]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    try {
      const input = buildPlanInput(form);
      if (isNew) {
        await api.createPlan(input);
      } else {
        await api.updatePlan(planId, input);
      }
      navigate('/plans');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存套餐失败');
    } finally {
      setIsSaving(false);
    }
  }

  function handleProductChange(productCode: string): void {
    const product = productOptions.find((item) => item.productCode === productCode);
    setForm({
      ...form,
      productCode,
      productName: product?.productName ?? form.productName,
    });
  }

  function updateComplianceDisplay(patch: Partial<PlanComplianceDisplay>): void {
    setForm((current) => ({
      ...current,
      complianceDisplay: {
        ...current.complianceDisplay,
        ...patch,
      },
    }));
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={pageTitle}
        description="编辑套餐价格、时长、支付商品 ID、上下架状态和合规展示"
        actions={(
          <Button icon={<ArrowLeft size={16} strokeWidth={2} />} onClick={() => navigate('/plans')}>
            返回列表
          </Button>
        )}
      />

      <section className="panel">
        <PanelState
          errorMessage={errorMessage}
          isEmpty={false}
          isLoading={isLoading}
          onRetry={loadPlan}
        />
        {!isLoading ? (
          <form className="tool-edit-form" onSubmit={(event) => void handleSubmit(event)}>
            <section className="form-section">
              <div className="form-section__header">
                <h2>基础配置</h2>
              </div>
              <div className="form-grid form-grid--four">
                <label className="field">
                  <span>商品类型</span>
                  <select required disabled={!isNew} value={form.productCode} onChange={(event) => handleProductChange(event.target.value)}>
                    <option value="">选择商品类型</option>
                    {productOptions.map((product) => (
                      <option value={product.productCode} key={product.id}>{product.productName}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>商品名称</span>
                  <input required value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} />
                </label>
                <label className="field">
                  <span>套餐编码</span>
                  <input required disabled={!isNew} value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })} placeholder="codex_basic" />
                </label>
                <label className="field">
                  <span>套餐名称</span>
                  <input required value={form.planName} onChange={(event) => setForm({ ...form, planName: event.target.value })} placeholder="Codex 标准版" />
                </label>
                <label className="field">
                  <span>状态</span>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })}>
                    <option value="on">上架</option>
                    <option value="off">下架</option>
                  </select>
                </label>
                <label className="field">
                  <span>排序值</span>
                  <input min="0" type="number" value={form.sort} onChange={(event) => setForm({ ...form, sort: event.target.value })} />
                </label>
                <label className="check-field">
                  <input checked={form.autoRenewEnabled} type="checkbox" onChange={(event) => setForm({ ...form, autoRenewEnabled: event.target.checked })} />
                  <span>自动续费</span>
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>价格与支付</h2>
              </div>
              <div className="form-grid form-grid--four">
                <label className="field">
                  <span>价格</span>
                  <input min="0" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
                </label>
                <label className="field">
                  <span>AI 工具总积分</span>
                  <input min="0" type="number" value={form.totalAiPoints} onChange={(event) => setForm({ ...form, totalAiPoints: event.target.value })} />
                </label>
                <label className="field">
                  <span>有效天数</span>
                  <input min="1" type="number" value={form.durationDays} onChange={(event) => setForm({ ...form, durationDays: event.target.value })} />
                </label>
                <label className="field field--wide">
                  <span>虚拟支付商品 ID</span>
                  <input value={form.virtualPaymentProductId} onChange={(event) => setForm({ ...form, virtualPaymentProductId: event.target.value })} placeholder="aionhub_codex_basic" />
                </label>
                <label className="field field--wide">
                  <span>套餐说明</span>
                  <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>合规展示</h2>
              </div>
              <div className="form-grid form-grid--two">
                <label className="check-field">
                  <input checked={form.complianceEnabled} type="checkbox" onChange={(event) => setForm({ ...form, complianceEnabled: event.target.checked })} />
                  <span>启用合规展示</span>
                </label>
              </div>
              {form.complianceEnabled ? (
                <div className="form-grid form-grid--two">
                  <label className="field">
                    <span>合规商品名称</span>
                    <input required value={form.complianceDisplay.productName} onChange={(event) => updateComplianceDisplay({ productName: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>合规套餐名称</span>
                    <input required value={form.complianceDisplay.planName} onChange={(event) => updateComplianceDisplay({ planName: event.target.value })} />
                  </label>
                  <label className="field field--wide">
                    <span>合规说明</span>
                    <textarea required rows={3} value={form.complianceDisplay.description ?? ''} onChange={(event) => updateComplianceDisplay({ description: event.target.value })} />
                  </label>
                </div>
              ) : null}
            </section>

            <div className="sticky-actions">
              <Button type="button" onClick={() => navigate('/plans')}>取消</Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? '保存中' : '保存套餐'}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
