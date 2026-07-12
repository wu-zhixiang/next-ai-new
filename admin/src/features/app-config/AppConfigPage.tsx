import { Save } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { useAdminApi } from '../../hooks/useAdminApi';
import type { AppConfigInput, AppConfigRecord, PaymentType } from '../../types/admin';
import { formatDateTime } from '../../utils/format';

interface AppConfigFormState {
  readonly enableHomeAuthModal: boolean;
  readonly enableProductComplianceMode: boolean;
  readonly paymentType: PaymentType;
}

const DEFAULT_APP_CONFIG: AppConfigFormState = {
  enableHomeAuthModal: true,
  enableProductComplianceMode: false,
  paymentType: 'virtual',
};

const PAYMENT_TYPE_OPTIONS: readonly {
  readonly value: PaymentType;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'standard',
    label: 'standard',
    description: '微信普通支付',
  },
  {
    value: 'virtual',
    label: 'virtual',
    description: '微信虚拟支付',
  },
];

function createFormFromConfig(config: AppConfigRecord): AppConfigFormState {
  return {
    enableHomeAuthModal: config.enableHomeAuthModal !== false,
    enableProductComplianceMode: config.enableProductComplianceMode === true,
    paymentType: config.paymentType === 'standard' ? 'standard' : 'virtual',
  };
}

function buildInput(form: AppConfigFormState): AppConfigInput {
  return {
    enableHomeAuthModal: form.enableHomeAuthModal,
    enableProductComplianceMode: form.enableProductComplianceMode,
    paymentType: form.paymentType,
  };
}

export function AppConfigPage(): JSX.Element {
  const api = useAdminApi();
  const [form, setForm] = useState<AppConfigFormState>(DEFAULT_APP_CONFIG);
  const [updatedAt, setUpdatedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadConfig = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const config = await api.getAppConfig();
      setForm(createFormFromConfig(config));
      setUpdatedAt(config.updatedAt);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'APP Config 读取失败');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const config = await api.updateAppConfig(buildInput(form));
      setForm(createFormFromConfig(config));
      setUpdatedAt(config.updatedAt);
      setSuccessMessage('APP Config 已保存');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'APP Config 保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="APP Config"
        description="配置小程序客户端开关和支付方式，保存后前端通过 app_config/client 生效"
      />

      <section className="panel">
        <PanelState
          errorMessage={errorMessage}
          isEmpty={false}
          isLoading={isLoading}
          onRetry={loadConfig}
        />

        {!isLoading ? (
          <form className="tool-edit-form" onSubmit={(event) => void handleSubmit(event)}>
            <section className="form-section">
              <div className="form-section__header">
                <h2>基础开关</h2>
                <span>{updatedAt ? `最后保存：${formatDateTime(updatedAt)}` : '默认首页授权开启'}</span>
              </div>
              <div className="form-grid form-grid--four">
                <label className="check-field">
                  <input
                    checked={form.enableHomeAuthModal}
                    type="checkbox"
                    onChange={(event) => setForm({ ...form, enableHomeAuthModal: event.target.checked })}
                  />
                  <span>开启首页微信授权登录</span>
                </label>
                <label className="check-field">
                  <input
                    checked={form.enableProductComplianceMode}
                    type="checkbox"
                    onChange={(event) => setForm({ ...form, enableProductComplianceMode: event.target.checked })}
                  />
                  <span>开启合规规避审核</span>
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>支付方式</h2>
                <span>影响新创建订单的支付渠道</span>
              </div>
              <div className="app-config-radio-list" role="radiogroup" aria-label="支付方式">
                {PAYMENT_TYPE_OPTIONS.map((option) => (
                  <label className={`app-config-radio ${form.paymentType === option.value ? 'app-config-radio--active' : ''}`} key={option.value}>
                    <input
                      checked={form.paymentType === option.value}
                      name="paymentType"
                      type="radio"
                      value={option.value}
                      onChange={() => setForm({ ...form, paymentType: option.value })}
                    />
                    <span className="app-config-radio__content">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {successMessage ? <div className="inline-success" role="status">{successMessage}</div> : null}
            {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}

            <div className="sticky-actions">
              <Button type="button" onClick={() => void loadConfig()}>重置</Button>
              <Button type="submit" variant="primary" icon={<Save size={16} strokeWidth={2} />} disabled={isSaving}>
                {isSaving ? '保存中' : '保存配置'}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
