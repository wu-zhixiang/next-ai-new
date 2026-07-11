import { CheckCircle2, Copy, ExternalLink, FileUp, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useCallback, useId, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useRemoteItems } from '../../hooks/useRemoteItems';
import type { AdminFileInput, AdminFileRecord, AdminFileUsage, UploadFileResult } from '../../types/admin';
import { formatDateTime } from '../../utils/format';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const fileUsageOptions: readonly { readonly value: AdminFileUsage; readonly label: string }[] = [
  { value: 'icon', label: '页面 icon' },
  { value: 'image', label: '页面图片' },
  { value: 'document', label: '文档素材' },
  { value: 'other', label: '其他文件' },
];

const fileUsageLabels: Record<AdminFileUsage, string> = {
  icon: '页面 icon',
  image: '页面图片',
  document: '文档素材',
  other: '其他文件',
};

function formatFileSize(value: number): string {
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${value} B`;
}

function isImageFile(file: AdminFileRecord): boolean {
  return file.mimeType.startsWith('image/');
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function createEmptyEditForm(): AdminFileInput {
  return {
    displayName: '',
    usage: 'icon',
    note: '',
  };
}

export function FileUploadPage(): JSX.Element {
  const api = useAdminApi();
  const fileInputId = useId();
  const loader = useCallback(() => api.listFiles(), [api]);
  const remote = useRemoteItems<AdminFileRecord>('admin.files', loader);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [usage, setUsage] = useState<AdminFileUsage>('icon');
  const [note, setNote] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadFileResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [keyword, setKeyword] = useState('');
  const [usageFilter, setUsageFilter] = useState<AdminFileUsage | 'all'>('all');
  const [editTarget, setEditTarget] = useState<AdminFileRecord | null>(null);
  const [editForm, setEditForm] = useState<AdminFileInput>(createEmptyEditForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminFileRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredFiles = useMemo(() => {
    const normalizedKeyword = normalizeKeyword(keyword);
    return remote.items.filter((file) => {
      const usageMatched = usageFilter === 'all' || file.usage === usageFilter;
      const keywordMatched = !normalizedKeyword
        || file.displayName.toLowerCase().includes(normalizedKeyword)
        || file.name.toLowerCase().includes(normalizedKeyword)
        || file.cloudPath.toLowerCase().includes(normalizedKeyword)
        || file.fileId.toLowerCase().includes(normalizedKeyword)
        || file.note.toLowerCase().includes(normalizedKeyword);
      return usageMatched && keywordMatched;
    });
  }, [keyword, remote.items, usageFilter]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setSuccessMessage('');
    setUploadResult(null);
    if (!file) {
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setErrorMessage('文件不能超过 10MB');
      return;
    }
    setSelectedFile(file);
    setDisplayName(file.name);
    setErrorMessage('');
  }

  async function handleUpload(): Promise<void> {
    if (!selectedFile) {
      setErrorMessage('请先选择文件');
      return;
    }
    setIsUploading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await api.uploadFileChunked({
        file: selectedFile,
        displayName: displayName.trim() || selectedFile.name,
        usage,
        note: note.trim(),
      });
      setUploadResult(result);
      setSuccessMessage('文件上传成功，已加入文件管理列表');
      setSelectedFile(null);
      setDisplayName('');
      setNote('');
      await remote.reload({ force: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '文件上传失败');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCopy(value: string, message: string): Promise<void> {
    if (!value) {
      return;
    }
    try {
      await copyText(value);
      setSuccessMessage(message);
      setErrorMessage('');
      setActionError('');
    } catch {
      setErrorMessage('复制失败，请手动复制');
    }
  }

  function openEditDialog(file: AdminFileRecord): void {
    setEditTarget(file);
    setEditForm({
      displayName: file.displayName,
      usage: file.usage,
      note: file.note,
    });
    setActionError('');
  }

  async function saveFileEdit(): Promise<void> {
    if (!editTarget) {
      return;
    }
    const nextDisplayName = editForm.displayName.trim();
    if (!nextDisplayName) {
      setActionError('文件展示名不能为空');
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      await api.updateFile(editTarget.id, {
        displayName: nextDisplayName,
        usage: editForm.usage,
        note: editForm.note.trim(),
      });
      await remote.reload({ force: true });
      setEditTarget(null);
      setSuccessMessage('文件信息已更新');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '更新文件失败');
    } finally {
      setIsMutating(false);
    }
  }

  async function confirmDeleteFile(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      await api.deleteFile(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
      setSuccessMessage('文件已删除');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除文件失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<AdminFileRecord>[] = [
    {
      id: 'preview',
      header: '预览',
      width: '92px',
      cell: (row) => (
        <div className="file-thumb">
          {isImageFile(row) && row.tempUrl ? (
            <img src={row.tempUrl} alt={row.displayName} />
          ) : (
            <span>{row.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}</span>
          )}
        </div>
      ),
    },
    {
      id: 'file',
      header: '文件',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.displayName}</strong>
          <span>{row.name} / {row.mimeType}</span>
          <code className="file-code">{row.cloudPath}</code>
        </div>
      ),
    },
    {
      id: 'usage',
      header: '用途',
      cell: (row) => <StatusBadge label={fileUsageLabels[row.usage]} tone={row.usage === 'icon' ? 'success' : 'neutral'} />,
    },
    {
      id: 'size',
      header: '大小',
      align: 'right',
      cell: (row) => formatFileSize(row.size),
    },
    {
      id: 'updatedAt',
      header: '更新时间',
      cell: (row) => formatDateTime(row.updatedAt),
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => void handleCopy(row.fileId, '配置值已复制')} aria-label="复制配置值" title="复制配置值">
            <Copy size={16} strokeWidth={2} />
          </button>
          {row.tempUrl ? (
            <a className="icon-button" href={row.tempUrl} rel="noreferrer" target="_blank" aria-label="打开预览" title="打开预览">
              <ExternalLink size={16} strokeWidth={2} />
            </a>
          ) : null}
          <button className="icon-button" type="button" onClick={() => openEditDialog(row)} aria-label="编辑文件" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除文件" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="文件管理"
        description="上传和管理页面 icon、图片、文档等后台素材，配置时优先使用 cloud fileId"
        actions={(
          <Button icon={<RefreshCw size={16} strokeWidth={2} />} onClick={() => void remote.reload({ force: true })}>
            刷新列表
          </Button>
        )}
      />

      <section className="panel file-upload-panel">
        <div className="file-upload-area">
          <input id={fileInputId} type="file" onChange={handleFileChange} />
          <label className="file-upload-dropzone" htmlFor={fileInputId}>
            <span className="file-upload-dropzone__icon">
              <FileUp size={28} strokeWidth={2} />
            </span>
            <strong>{selectedFile ? selectedFile.name : '选择文件上传'}</strong>
            <span>单个文件 10MB 以内，上传后进入文件管理列表</span>
          </label>

          {selectedFile ? (
            <div className="file-upload-meta">
              <span>{selectedFile.type || '未知类型'}</span>
              <strong>{formatFileSize(selectedFile.size)}</strong>
            </div>
          ) : null}

          <div className="form-grid form-grid--two">
            <label className="field">
              <span>展示名称</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="默认使用文件名" />
            </label>
            <label className="field">
              <span>文件用途</span>
              <select value={usage} onChange={(event) => setUsage(event.target.value as AdminFileUsage)}>
                {fileUsageOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="field field--wide">
              <span>备注</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：老照片修复上传框 icon" rows={3} />
            </label>
          </div>

          <div className="button-row">
            <Button
              disabled={!selectedFile || isUploading}
              icon={<Upload size={16} strokeWidth={2} />}
              onClick={() => void handleUpload()}
              variant="primary"
            >
              {isUploading ? '上传中' : '上传文件'}
            </Button>
          </div>
        </div>

        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {successMessage ? (
          <div className="inline-success file-upload-success">
            <CheckCircle2 size={15} strokeWidth={2} />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {uploadResult ? (
          <div className="file-upload-result">
            <label className="field">
              <span>配置值（小程序 / 页面素材使用）</span>
              <input readOnly value={uploadResult.fileId} />
            </label>
            <p className="file-upload-hint">
              页面 icon 等小程序素材优先复制 fileId；临时预览链接带签名，不能作为长期素材地址。
            </p>
            <div className="button-row">
              <Button
                icon={<Copy size={15} strokeWidth={2} />}
                onClick={() => void handleCopy(uploadResult.fileId, '配置值已复制')}
                size="sm"
              >
                复制配置值
              </Button>
              {uploadResult.tempUrl ? (
                <a className="button button--secondary button--sm" href={uploadResult.tempUrl} rel="noreferrer" target="_blank">
                  <span className="button-icon"><ExternalLink size={15} strokeWidth={2} /></span>
                  <span>打开预览</span>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索文件</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="展示名 / 文件名 / 路径 / fileId" />
          </label>
          <label className="select-field">
            <span>用途</span>
            <select value={usageFilter} onChange={(event) => setUsageFilter(event.target.value as AdminFileUsage | 'all')}>
              <option value="all">全部</option>
              {fileUsageOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
        <PanelState
          errorMessage={remote.errorMessage}
          isEmpty={filteredFiles.length === 0}
          isLoading={remote.isLoading}
          emptyText="暂无文件，请先上传素材"
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredFiles} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <Modal
        open={Boolean(editTarget)}
        title="编辑文件信息"
        onClose={isMutating ? () => undefined : () => setEditTarget(null)}
      >
        <div className="file-edit-form">
          <label className="field">
            <span>展示名称</span>
            <input
              value={editForm.displayName}
              onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>文件用途</span>
            <select
              value={editForm.usage}
              onChange={(event) => setEditForm((current) => ({ ...current, usage: event.target.value as AdminFileUsage }))}
            >
              {fileUsageOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>备注</span>
            <textarea
              value={editForm.note}
              onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))}
              rows={4}
            />
          </label>
        </div>
        <div className="button-row button-row--right modal-actions">
          <Button type="button" disabled={isMutating} onClick={() => setEditTarget(null)}>取消</Button>
          <Button type="button" disabled={isMutating} variant="primary" onClick={() => void saveFileEdit()}>
            {isMutating ? '保存中' : '保存'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除文件"
        description={`确认删除文件「${deleteTarget?.displayName ?? ''}」？删除后云存储文件和后台记录都会移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteFile()}
      />
    </div>
  );
}
