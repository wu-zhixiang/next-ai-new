import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { useAdminApi } from '../../hooks/useAdminApi';
import type { ProductComplianceDisplay, ProductIntroHighlight, ProductStatus, ProductTypeInput, ProductTypeRecord } from '../../types/admin';

interface ProductTypeFormState {
  readonly productCode: string;
  readonly productName: string;
  readonly label: string;
  readonly tag: string;
  readonly avatarUrl: string;
  readonly detailPageUrl: string;
  readonly available: boolean;
  readonly description: string;
  readonly introHighlights: readonly ProductIntroHighlight[];
  readonly complianceEnabled: boolean;
  readonly complianceDisplay: ProductComplianceDisplay;
  readonly sort: string;
  readonly status: ProductStatus;
}

const emptyComplianceDisplay: ProductComplianceDisplay = {
  productName: '',
  label: '',
  tag: '',
  avatarUrl: '',
  detailPageUrl: '',
  description: '',
  introHighlights: [],
};

function createEmptyForm(): ProductTypeFormState {
  return {
    productCode: '',
    productName: '',
    label: '',
    tag: '',
    avatarUrl: '',
    detailPageUrl: '',
    available: false,
    description: '',
    introHighlights: [],
    complianceEnabled: false,
    complianceDisplay: emptyComplianceDisplay,
    sort: '999',
    status: 'off',
  };
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeHighlights(value: readonly ProductIntroHighlight[] | undefined): ProductIntroHighlight[] {
  return (value ?? []).map((item) => ({
    title: safeString(item.title),
    description: safeString(item.description),
  }));
}

function createFormFromProduct(product: ProductTypeRecord): ProductTypeFormState {
  return {
    productCode: safeString(product.productCode),
    productName: safeString(product.productName),
    label: safeString(product.label),
    tag: safeString(product.tag),
    avatarUrl: safeString(product.avatarUrl),
    detailPageUrl: safeString(product.detailPageUrl),
    available: product.available,
    description: safeString(product.description),
    introHighlights: normalizeHighlights(product.introHighlights),
    complianceEnabled: product.complianceEnabled ?? Boolean(product.complianceDisplay),
    complianceDisplay: {
      productName: safeString(product.complianceDisplay?.productName),
      label: safeString(product.complianceDisplay?.label),
      tag: safeString(product.complianceDisplay?.tag),
      avatarUrl: safeString(product.complianceDisplay?.avatarUrl),
      detailPageUrl: safeString(product.complianceDisplay?.detailPageUrl),
      description: safeString(product.complianceDisplay?.description),
      introHighlights: normalizeHighlights(product.complianceDisplay?.introHighlights),
    },
    sort: String(Number.isFinite(product.sort) ? product.sort : 999),
    status: product.status,
  };
}

function findProduct(products: readonly ProductTypeRecord[], productId: string): ProductTypeRecord | undefined {
  return products.find((product) => product.id === productId || product.productCode === productId);
}

function buildOptionalComplianceDisplay(value: ProductComplianceDisplay): ProductComplianceDisplay | undefined {
  const introHighlights = normalizeHighlights(value.introHighlights)
    .map((item) => ({ title: item.title.trim(), description: item.description.trim() }))
    .filter((item) => item.title || item.description);
  const nextValue: ProductComplianceDisplay = {
    productName: value.productName.trim(),
    label: value.label.trim(),
    tag: value.tag.trim(),
    avatarUrl: value.avatarUrl?.trim() || '',
    detailPageUrl: value.detailPageUrl?.trim() || '',
    description: value.description.trim(),
    introHighlights,
  };
  const hasContent = nextValue.productName
    || nextValue.label
    || nextValue.tag
    || nextValue.avatarUrl
    || nextValue.detailPageUrl
    || nextValue.description
    || introHighlights.length > 0;
  return hasContent ? nextValue : undefined;
}

function buildProductInput(form: ProductTypeFormState): ProductTypeInput {
  const sort = Number.parseInt(form.sort, 10);
  const complianceDisplay = form.complianceEnabled
    ? buildOptionalComplianceDisplay(form.complianceDisplay)
    : undefined;
  return {
    productCode: form.productCode.trim(),
    productName: form.productName.trim(),
    label: form.label.trim(),
    tag: form.tag.trim(),
    avatarUrl: form.avatarUrl.trim(),
    detailPageUrl: form.detailPageUrl.trim(),
    available: form.available,
    description: form.description.trim(),
    introHighlights: form.introHighlights
      .map((item) => ({ title: item.title.trim(), description: item.description.trim() }))
      .filter((item) => item.title || item.description),
    complianceEnabled: form.complianceEnabled,
    sort: Number.isFinite(sort) ? sort : 999,
    status: form.status,
    ...(complianceDisplay ? { complianceDisplay } : {}),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('图片读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

interface ImageUploadFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onUpload: (file: File) => Promise<string>;
}

function ImageUploadField({ label, onChange, onUpload, value }: ImageUploadFieldProps): JSX.Element {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setIsUploading(true);
    setErrorMessage('');
    try {
      onChange(await onUpload(file));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="image-upload-field">
      <div className="image-upload-field__head">
        <span>{label}</span>
        <label className="button button--secondary button--sm" htmlFor={inputId}>
          <span className="button-icon"><Upload size={14} strokeWidth={2} /></span>
          <span>{isUploading ? '上传中' : '上传图片'}</span>
        </label>
      </div>
      <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleFileChange(event)} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="cloud:// 或 https:// 图片地址" />
      {value ? <div className="image-upload-field__value">{value}</div> : null}
      {errorMessage ? <div className="field-error">{errorMessage}</div> : null}
    </div>
  );
}

export function ProductTypeEditPage(): JSX.Element {
  const api = useAdminApi();
  const navigate = useNavigate();
  const { productId = '' } = useParams();
  const isNew = !productId;
  const [form, setForm] = useState<ProductTypeFormState>(createEmptyForm);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pageTitle = useMemo(() => (isNew ? '新增商品类型' : `编辑 ${form.productName || '商品类型'}`), [form.productName, isNew]);

  const loadProduct = useCallback(async (): Promise<void> => {
    if (isNew) {
      setForm(createEmptyForm());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const products = await api.listProductTypes();
      const target = findProduct(products, productId);
      if (!target) {
        throw new Error('商品类型不存在');
      }
      setForm(createFormFromProduct(target));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '商品类型读取失败');
    } finally {
      setIsLoading(false);
    }
  }, [api, isNew, productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  async function uploadImage(file: File): Promise<string> {
    if (!/^image\/(?:png|jpe?g|webp)$/.test(file.type)) {
      throw new Error('图片仅支持 PNG/JPG/WebP');
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('图片不能超过 3MB');
    }
    const dataUrl = await readFileAsDataUrl(file);
    const result = await api.uploadToolImage(dataUrl);
    return result.fileId;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    try {
      const input = buildProductInput(form);
      if (isNew) {
        await api.createProductType(input);
      } else {
        await api.updateProductType(productId, input);
      }
      navigate('/product-types');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存商品类型失败');
    } finally {
      setIsSaving(false);
    }
  }

  function updateHighlight(index: number, patch: Partial<ProductIntroHighlight>): void {
    setForm((current) => ({
      ...current,
      introHighlights: current.introHighlights.map((item, currentIndex) => (
        currentIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function updateComplianceDisplay(patch: Partial<ProductComplianceDisplay>): void {
    setForm((current) => ({
      ...current,
      complianceDisplay: {
        ...current.complianceDisplay,
        ...patch,
      },
    }));
  }

  function updateComplianceHighlight(index: number, patch: Partial<ProductIntroHighlight>): void {
    updateComplianceDisplay({
      introHighlights: (form.complianceDisplay.introHighlights ?? []).map((item, currentIndex) => (
        currentIndex === index ? { ...item, ...patch } : item
      )),
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={pageTitle}
        description="编辑商品入口、小程序介绍、可选状态和合规展示"
        actions={(
          <Button icon={<ArrowLeft size={16} strokeWidth={2} />} onClick={() => navigate('/product-types')}>
            返回列表
          </Button>
        )}
      />

      <section className="panel">
        <PanelState
          errorMessage={errorMessage}
          isEmpty={false}
          isLoading={isLoading}
          onRetry={loadProduct}
        />
        {!isLoading ? (
          <form className="tool-edit-form" onSubmit={(event) => void handleSubmit(event)}>
            <section className="form-section">
              <div className="form-section__header">
                <h2>基础配置</h2>
              </div>
              <div className="form-grid form-grid--four">
                <label className="field">
                  <span>商品编码</span>
                  <input required disabled={!isNew} value={form.productCode} onChange={(event) => setForm({ ...form, productCode: event.target.value })} placeholder="ai_news" />
                </label>
                <label className="field">
                  <span>商品名称</span>
                  <input required value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} placeholder="Chatgpt" />
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
                  <input checked={form.available} type="checkbox" onChange={(event) => setForm({ ...form, available: event.target.checked })} />
                  <span>允许用户选择</span>
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>小程序商品卡片</h2>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>展示标题</span>
                  <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Chatgpt" />
                </label>
                <label className="field">
                  <span>标签</span>
                  <input value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} placeholder="ChatGPT + Codex" />
                </label>
                <ImageUploadField
                  label="头像图片地址"
                  value={form.avatarUrl}
                  onChange={(value) => setForm({ ...form, avatarUrl: value })}
                  onUpload={uploadImage}
                />
                <label className="field field--wide">
                  <span>详情页路径</span>
                  <input value={form.detailPageUrl} onChange={(event) => setForm({ ...form, detailPageUrl: event.target.value })} placeholder="pages/news-detail/index?id=..." />
                </label>
                <label className="field field--wide">
                  <span>商品说明</span>
                  <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>介绍高亮</h2>
                <Button
                  size="sm"
                  icon={<Plus size={14} strokeWidth={2} />}
                  onClick={() => setForm({ ...form, introHighlights: [...form.introHighlights, { title: '', description: '' }] })}
                >
                  添加
                </Button>
              </div>
              <div className="repeat-list">
                {form.introHighlights.map((item, index) => (
                  <div className="repeat-item" key={`highlight-${index}`}>
                    <label className="field">
                      <span>标题</span>
                      <input value={item.title} onChange={(event) => updateHighlight(index, { title: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>描述</span>
                      <textarea rows={3} value={item.description} onChange={(event) => updateHighlight(index, { description: event.target.value })} />
                    </label>
                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      onClick={() => setForm({ ...form, introHighlights: form.introHighlights.filter((_, currentIndex) => currentIndex !== index) })}
                      aria-label="删除介绍高亮"
                      title="删除"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>合规展示</h2>
              </div>
              <label className="check-field">
                <input checked={form.complianceEnabled} type="checkbox" onChange={(event) => setForm({ ...form, complianceEnabled: event.target.checked })} />
                <span>启用合规展示</span>
              </label>
              {form.complianceEnabled ? (
                <>
                  <div className="form-grid form-grid--two">
                    <label className="field">
                      <span>合规商品名称</span>
                      <input value={form.complianceDisplay.productName} onChange={(event) => updateComplianceDisplay({ productName: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>合规展示标题</span>
                      <input value={form.complianceDisplay.label} onChange={(event) => updateComplianceDisplay({ label: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>合规标签</span>
                      <input value={form.complianceDisplay.tag} onChange={(event) => updateComplianceDisplay({ tag: event.target.value })} />
                    </label>
                    <ImageUploadField
                      label="合规头像地址"
                      value={form.complianceDisplay.avatarUrl ?? ''}
                      onChange={(value) => updateComplianceDisplay({ avatarUrl: value })}
                      onUpload={uploadImage}
                    />
                    <label className="field field--wide">
                      <span>合规详情页路径</span>
                      <input value={form.complianceDisplay.detailPageUrl ?? ''} onChange={(event) => updateComplianceDisplay({ detailPageUrl: event.target.value })} />
                    </label>
                    <label className="field field--wide">
                      <span>合规说明</span>
                      <textarea rows={3} value={form.complianceDisplay.description} onChange={(event) => updateComplianceDisplay({ description: event.target.value })} />
                    </label>
                  </div>
                  <div className="form-section__header">
                    <h2>合规高亮</h2>
                    <Button
                      size="sm"
                      icon={<Plus size={14} strokeWidth={2} />}
                      onClick={() => updateComplianceDisplay({ introHighlights: [...(form.complianceDisplay.introHighlights ?? []), { title: '', description: '' }] })}
                    >
                      添加
                    </Button>
                  </div>
                  <div className="repeat-list">
                    {(form.complianceDisplay.introHighlights ?? []).map((item, index) => (
                      <div className="repeat-item" key={`compliance-highlight-${index}`}>
                        <label className="field">
                          <span>标题</span>
                          <input value={item.title} onChange={(event) => updateComplianceHighlight(index, { title: event.target.value })} />
                        </label>
                        <label className="field">
                          <span>描述</span>
                          <textarea rows={3} value={item.description} onChange={(event) => updateComplianceHighlight(index, { description: event.target.value })} />
                        </label>
                        <button
                          className="icon-button icon-button--danger"
                          type="button"
                          onClick={() => updateComplianceDisplay({ introHighlights: (form.complianceDisplay.introHighlights ?? []).filter((_, currentIndex) => currentIndex !== index) })}
                          aria-label="删除合规高亮"
                          title="删除"
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <div className="sticky-actions">
              <Button type="button" onClick={() => navigate('/product-types')}>取消</Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? '保存中' : '保存商品类型'}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
