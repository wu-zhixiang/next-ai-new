import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useId, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { useAdminApi } from '../../hooks/useAdminApi';
import type {
  AiToolCategory,
  AiToolInput,
  AiToolIntroCase,
  AiToolOutputType,
  AiToolRecord,
  ToolStatus,
} from '../../types/admin';

interface EditableHighlight {
  readonly title: string;
  readonly desc: string;
}

interface EditableCompareCase {
  readonly mode: 'compare';
  readonly title: string;
  readonly before: string;
  readonly after: string;
  readonly beforeImageFileId: string;
  readonly afterImageFileId: string;
}

interface EditablePreviewCase {
  readonly mode: 'preview';
  readonly title: string;
  readonly previewImageFileId: string;
  readonly previewDescription: string;
}

type EditableCase = EditableCompareCase | EditablePreviewCase;

interface EditableIntro {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly highlights: readonly EditableHighlight[];
  readonly cases: readonly EditableCase[];
  readonly tips: readonly string[];
}

interface ToolFormState {
  readonly name: string;
  readonly category: AiToolCategory;
  readonly status: ToolStatus;
  readonly pointCost: string;
  readonly trialLimit: string;
  readonly sortOrder: string;
  readonly cardTitle: string;
  readonly cardDescription: string;
  readonly tagsText: string;
  readonly icon: string;
  readonly iconImageFileId: string;
  readonly visible: boolean;
  readonly outputType: AiToolOutputType;
  readonly workerModel: string;
  readonly intro: EditableIntro;
}

const WORKER_MODEL_OPTIONS = [
  { value: 'google:image-lite', label: 'Gemini 低成本图片模型' },
  { value: 'google:image-flash', label: 'Gemini 主力图片模型' },
  { value: 'google:image-pro', label: 'Gemini 高质量图片模型' },
  { value: 'openai:gpt-image-1.5', label: 'Azure OpenAI 图片模型' },
] as const;

const blankIntro: EditableIntro = {
  eyebrow: '',
  title: '',
  subtitle: '',
  highlights: [],
  cases: [],
  tips: [],
};

function createEmptyForm(): ToolFormState {
  return {
    name: '',
    category: 'text',
    status: 'testing',
    pointCost: '0',
    trialLimit: '0',
    sortOrder: '999',
    cardTitle: '',
    cardDescription: '',
    tagsText: '接入中',
    icon: 'AI',
    iconImageFileId: '',
    visible: true,
    outputType: 'summary',
    workerModel: 'google:image-flash',
    intro: blankIntro,
  };
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseTags(value: unknown): string[] {
  const source = safeString(value)
    .split(/[,\n，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(source)).slice(0, 8);
}

function toEditableCase(item: AiToolIntroCase): EditableCase {
  if (item.mode === 'preview') {
    return {
      mode: 'preview',
      title: safeString(item.title),
      previewImageFileId: safeString(item.previewImageFileId),
      previewDescription: safeString(item.previewDescription),
    };
  }
  return {
    mode: 'compare',
    title: safeString(item.title),
    before: safeString(item.before),
    after: safeString(item.after),
    beforeImageFileId: safeString(item.beforeImageFileId),
    afterImageFileId: safeString(item.afterImageFileId),
  };
}

function createFormFromTool(tool: AiToolRecord): ToolFormState {
  const tags = Array.isArray(tool.tags) && tool.tags.length > 0 ? tool.tags : [tool.cardBadge].filter(Boolean);
  return {
    name: safeString(tool.name),
    category: tool.category,
    status: tool.status,
    pointCost: String(tool.pointCost),
    trialLimit: String(tool.trialLimit),
    sortOrder: String(Number.isFinite(tool.sortOrder) ? tool.sortOrder : 999),
    cardTitle: safeString(tool.cardTitle),
    cardDescription: safeString(tool.cardDescription),
    tagsText: tags.join('、'),
    icon: safeString(tool.icon) || 'AI',
    iconImageFileId: safeString(tool.iconImageFileId),
    visible: tool.visible !== false,
    outputType: tool.outputType ?? 'summary',
    workerModel: safeString(tool.workerModel) || 'google:image-flash',
    intro: {
      eyebrow: safeString(tool.intro?.eyebrow),
      title: safeString(tool.intro?.title),
      subtitle: safeString(tool.intro?.subtitle),
      highlights: tool.intro?.highlights.map((item) => ({ title: safeString(item.title), desc: safeString(item.desc) })) ?? [],
      cases: tool.intro?.cases.map(toEditableCase) ?? [],
      tips: tool.intro?.tips ? tool.intro.tips.map(safeString) : [],
    },
  };
}

function findTool(tools: readonly AiToolRecord[], toolId: string): AiToolRecord | undefined {
  return tools.find((tool) => tool.id === toolId || tool.toolId === toolId);
}

function buildToolInput(form: ToolFormState): AiToolInput {
  const tags = parseTags(form.tagsText);
  const sortOrder = Number.parseInt(safeString(form.sortOrder), 10);
  return {
    name: safeString(form.name).trim(),
    category: form.category,
    status: form.status,
    pointCost: Number.parseInt(safeString(form.pointCost), 10) || 0,
    trialLimit: Number.parseInt(safeString(form.trialLimit), 10) || 0,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 999,
    cardTitle: safeString(form.cardTitle).trim(),
    cardDescription: safeString(form.cardDescription).trim(),
    cardBadge: tags[0] ?? '',
    tags,
    icon: safeString(form.icon).trim(),
    iconImageFileId: safeString(form.iconImageFileId).trim(),
    visible: form.visible,
    outputType: form.outputType,
    workerModel: safeString(form.workerModel).trim(),
    intro: {
      eyebrow: safeString(form.intro.eyebrow).trim(),
      title: safeString(form.intro.title).trim(),
      subtitle: safeString(form.intro.subtitle).trim(),
      highlights: form.intro.highlights.map((item) => ({
        title: safeString(item.title).trim(),
        desc: safeString(item.desc).trim(),
      })),
      cases: form.intro.cases.map((item) => {
        if (item.mode === 'preview') {
          return {
            mode: 'preview',
            title: safeString(item.title).trim(),
            previewImageFileId: safeString(item.previewImageFileId).trim(),
            previewDescription: safeString(item.previewDescription).trim(),
          };
        }
        return {
          mode: 'compare',
          title: safeString(item.title).trim(),
          before: safeString(item.before).trim(),
          after: safeString(item.after).trim(),
          beforeImageFileId: safeString(item.beforeImageFileId).trim(),
          afterImageFileId: safeString(item.afterImageFileId).trim(),
        };
      }),
      tips: form.intro.tips.map((item) => safeString(item).trim()).filter(Boolean),
    },
  };
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

export function ToolEditPage(): JSX.Element {
  const api = useAdminApi();
  const navigate = useNavigate();
  const { toolId = '' } = useParams();
  const isNew = !toolId;
  const [form, setForm] = useState<ToolFormState>(createEmptyForm);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pageTitle = useMemo(() => (isNew ? '新增 AI 工具' : `编辑 ${form.cardTitle || form.name || 'AI 工具'}`), [form.cardTitle, form.name, isNew]);

  const loadTool = useCallback(async (): Promise<void> => {
    if (isNew) {
      setForm(createEmptyForm());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const tools = await api.listTools();
      const target = findTool(tools, toolId);
      if (!target) {
        throw new Error('工具不存在');
      }
      setForm(createFormFromTool(target));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '工具读取失败');
    } finally {
      setIsLoading(false);
    }
  }, [api, isNew, toolId]);

  useEffect(() => {
    void loadTool();
  }, [loadTool]);

  async function uploadImage(file: File): Promise<string> {
    if (!/^image\/(?:png|jpe?g|webp)$/.test(file.type)) {
      throw new Error('图片仅支持 PNG/JPG/WebP');
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('图片不能超过 3MB');
    }
    const result = await api.uploadToolImageFile(file);
    return result.fileId;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    try {
      const input = buildToolInput(form);
      if (isNew) {
        await api.createTool(input);
      } else {
        await api.updateTool(toolId, input);
      }
      navigate('/tools');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存工具失败');
    } finally {
      setIsSaving(false);
    }
  }

  function updateIntro(patch: Partial<EditableIntro>): void {
    setForm((current) => ({
      ...current,
      intro: {
        ...current.intro,
        ...patch,
      },
    }));
  }

  function updateHighlight(index: number, patch: Partial<EditableHighlight>): void {
    updateIntro({
      highlights: form.intro.highlights.map((item, currentIndex) => (
        currentIndex === index ? { ...item, ...patch } : item
      )),
    });
  }

  function updateCase(index: number, nextCase: EditableCase): void {
    updateIntro({
      cases: form.intro.cases.map((item, currentIndex) => (currentIndex === index ? nextCase : item)),
    });
  }

  function switchCaseMode(index: number, mode: EditableCase['mode']): void {
    const current = form.intro.cases[index];
    if (!current || current.mode === mode) {
      return;
    }
    if (mode === 'preview') {
      updateCase(index, {
        mode: 'preview',
        title: current.title,
        previewImageFileId: '',
        previewDescription: current.mode === 'compare' ? current.after : '',
      });
    } else {
      updateCase(index, {
        mode: 'compare',
        title: current.title,
        before: '',
        after: current.mode === 'preview' ? current.previewDescription : '',
        beforeImageFileId: '',
        afterImageFileId: current.mode === 'preview' ? current.previewImageFileId : '',
      });
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={pageTitle}
        description="编辑小程序工具卡片、介绍页首屏、适合处理和案例展示"
        actions={(
          <Button icon={<ArrowLeft size={16} strokeWidth={2} />} onClick={() => navigate('/tools')}>
            返回列表
          </Button>
        )}
      />

      <section className="panel">
        <PanelState
          errorMessage={errorMessage}
          isEmpty={false}
          isLoading={isLoading}
          onRetry={loadTool}
        />
        {!isLoading ? (
          <form className="tool-edit-form" onSubmit={(event) => void handleSubmit(event)}>
            <section className="form-section">
              <div className="form-section__header">
                <h2>基础配置</h2>
              </div>
              <div className="form-grid form-grid--four">
                <label className="field">
                  <span>内部名称</span>
                  <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label className="field">
                  <span>类型</span>
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as AiToolCategory })}>
                    <option value="text">文本</option>
                    <option value="image">图像</option>
                    <option value="video">视频</option>
                    <option value="workflow">工作流</option>
                  </select>
                </label>
                <label className="field">
                  <span>状态</span>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ToolStatus })}>
                    <option value="enabled">启用</option>
                    <option value="testing">灰度</option>
                    <option value="disabled">停用</option>
                  </select>
                </label>
                <label className="field">
                  <span>消耗积分</span>
                  <input min="0" type="number" value={form.pointCost} onChange={(event) => setForm({ ...form, pointCost: event.target.value })} />
                </label>
                <label className="field">
                  <span>体验次数</span>
                  <input min="0" type="number" value={form.trialLimit} onChange={(event) => setForm({ ...form, trialLimit: event.target.value })} />
                </label>
                <label className="field">
                  <span>排序值</span>
                  <input min="0" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
                </label>
                {form.category === 'image' || form.category === 'workflow' ? (
                  <label className="field field--wide">
                    <span>图片处理模型</span>
                    <select value={form.workerModel} onChange={(event) => setForm({ ...form, workerModel: event.target.value })}>
                      {WORKER_MODEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>小程序列表卡片</h2>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>标题</span>
                  <input value={form.cardTitle} onChange={(event) => setForm({ ...form, cardTitle: event.target.value })} placeholder="AI生图" />
                </label>
                <label className="field field--wide">
                  <span>表述</span>
                  <input value={form.cardDescription} onChange={(event) => setForm({ ...form, cardDescription: event.target.value })} placeholder="头像、海报、配图生成" />
                </label>
                <label className="field field--wide">
                  <span>工具标签</span>
                  <textarea
                    rows={2}
                    value={form.tagsText}
                    onChange={(event) => setForm({ ...form, tagsText: event.target.value })}
                    placeholder="多个标签用顿号、逗号或换行分隔，例如：热门、已上线、免费试用"
                  />
                </label>
                <label className="field">
                  <span>图标文案</span>
                  <input maxLength={8} value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} />
                </label>
                <ImageUploadField
                  label="图标图片"
                  value={form.iconImageFileId}
                  onChange={(value) => setForm({ ...form, iconImageFileId: value })}
                  onUpload={uploadImage}
                />
                <label className="field">
                  <span>默认输出</span>
                  <select value={form.outputType} onChange={(event) => setForm({ ...form, outputType: event.target.value as AiToolOutputType })}>
                    <option value="summary">摘要</option>
                    <option value="bullets">要点</option>
                    <option value="xiaohongshu">小红书</option>
                    <option value="moments">朋友圈</option>
                  </select>
                </label>
                <label className="check-field">
                  <input checked={form.visible} type="checkbox" onChange={(event) => setForm({ ...form, visible: event.target.checked })} />
                  <span>在小程序工具列表展示</span>
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>介绍页首屏</h2>
              </div>
              <div className="form-grid form-grid--two">
                <label className="field">
                  <span>眉标</span>
                  <input value={form.intro.eyebrow} onChange={(event) => updateIntro({ eyebrow: event.target.value })} />
                </label>
                <label className="field">
                  <span>标题</span>
                  <input value={form.intro.title} onChange={(event) => updateIntro({ title: event.target.value })} />
                </label>
                <label className="field field--wide">
                  <span>说明</span>
                  <textarea rows={3} value={form.intro.subtitle} onChange={(event) => updateIntro({ subtitle: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>适合处理</h2>
                <Button
                  size="sm"
                  icon={<Plus size={14} strokeWidth={2} />}
                  onClick={() => updateIntro({ highlights: [...form.intro.highlights, { title: '', desc: '' }] })}
                >
                  添加
                </Button>
              </div>
              <div className="repeat-list">
                {form.intro.highlights.map((item, index) => (
                  <div className="repeat-item" key={`highlight-${index}`}>
                    <label className="field">
                      <span>标题</span>
                      <input value={item.title} onChange={(event) => updateHighlight(index, { title: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>描述</span>
                      <textarea rows={3} value={item.desc} onChange={(event) => updateHighlight(index, { desc: event.target.value })} />
                    </label>
                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      onClick={() => updateIntro({ highlights: form.intro.highlights.filter((_, currentIndex) => currentIndex !== index) })}
                      aria-label="删除适合处理项"
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
                <h2>案例展示</h2>
                <Button
                  size="sm"
                  icon={<Plus size={14} strokeWidth={2} />}
                  onClick={() => updateIntro({ cases: [...form.intro.cases, { mode: 'compare', title: '', before: '', after: '', beforeImageFileId: '', afterImageFileId: '' }] })}
                >
                  添加
                </Button>
              </div>
              <div className="case-list">
                {form.intro.cases.map((item, index) => (
                  <div className="case-editor" key={`case-${index}`}>
                    <div className="case-editor__head">
                      <label className="field">
                        <span>案例标题</span>
                        <input value={item.title} onChange={(event) => updateCase(index, { ...item, title: event.target.value })} />
                      </label>
                      <label className="select-field">
                        <span>展示模式</span>
                        <select value={item.mode} onChange={(event) => switchCaseMode(index, event.target.value as EditableCase['mode'])}>
                          <option value="compare">对比</option>
                          <option value="preview">纯预览</option>
                        </select>
                      </label>
                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        onClick={() => updateIntro({ cases: form.intro.cases.filter((_, currentIndex) => currentIndex !== index) })}
                        aria-label="删除案例"
                        title="删除"
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </div>
                    {item.mode === 'compare' ? (
                      <div className="case-editor__grid">
                        <label className="field">
                          <span>处理前描述</span>
                          <textarea rows={3} value={item.before} onChange={(event) => updateCase(index, { ...item, before: event.target.value })} />
                        </label>
                        <label className="field">
                          <span>处理后描述</span>
                          <textarea rows={3} value={item.after} onChange={(event) => updateCase(index, { ...item, after: event.target.value })} />
                        </label>
                        <ImageUploadField
                          label="处理前图片"
                          value={item.beforeImageFileId}
                          onChange={(value) => updateCase(index, { ...item, beforeImageFileId: value })}
                          onUpload={uploadImage}
                        />
                        <ImageUploadField
                          label="处理后图片"
                          value={item.afterImageFileId}
                          onChange={(value) => updateCase(index, { ...item, afterImageFileId: value })}
                          onUpload={uploadImage}
                        />
                      </div>
                    ) : (
                      <div className="case-editor__grid">
                        <ImageUploadField
                          label="作品图片"
                          value={item.previewImageFileId}
                          onChange={(value) => updateCase(index, { ...item, previewImageFileId: value })}
                          onUpload={uploadImage}
                        />
                        <label className="field">
                          <span>作品说明</span>
                          <textarea rows={3} value={item.previewDescription} onChange={(event) => updateCase(index, { ...item, previewDescription: event.target.value })} />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>使用前确认</h2>
                <Button
                  size="sm"
                  icon={<Plus size={14} strokeWidth={2} />}
                  onClick={() => updateIntro({ tips: [...form.intro.tips, ''] })}
                >
                  添加
                </Button>
              </div>
              <div className="repeat-list">
                {form.intro.tips.map((item, index) => (
                  <div className="repeat-item repeat-item--inline" key={`tip-${index}`}>
                    <label className="field">
                      <span>提示</span>
                      <input
                        value={item}
                        onChange={(event) => updateIntro({
                          tips: form.intro.tips.map((tip, currentIndex) => (currentIndex === index ? event.target.value : tip)),
                        })}
                      />
                    </label>
                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      onClick={() => updateIntro({ tips: form.intro.tips.filter((_, currentIndex) => currentIndex !== index) })}
                      aria-label="删除提示"
                      title="删除"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
            <div className="sticky-actions">
              <Button onClick={() => navigate('/tools')}>取消</Button>
              <Button disabled={isSaving} type="submit" variant="primary">{isSaving ? '保存中' : '保存配置'}</Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
