import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { AiNewsInput, AiNewsRecord, NewsStatus } from '../../types/admin';

interface NewsEditorProps {
  readonly news: AiNewsRecord | null;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: AiNewsInput) => void;
}

interface NewsFormState {
  readonly title: string;
  readonly sourceName: string;
  readonly status: NewsStatus;
  readonly publishAt: string;
  readonly summary: string;
}

function toInputDateTime(value: string): string {
  return value.slice(0, 16);
}

function createInitialState(news: AiNewsRecord | null): NewsFormState {
  return {
    title: news?.title ?? '',
    sourceName: news?.sourceName ?? '编辑精选',
    status: news?.status ?? 'draft',
    publishAt: toInputDateTime(news?.publishAt ?? new Date().toISOString()),
    summary: news?.summary ?? '',
  };
}

export function NewsEditor({ news, onClose, onSubmit, open }: NewsEditorProps): JSX.Element {
  const [form, setForm] = useState<NewsFormState>(() => createInitialState(news));

  useEffect(() => {
    setForm(createInitialState(news));
  }, [news, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit({
      title: form.title.trim(),
      sourceName: form.sourceName.trim(),
      status: form.status,
      publishAt: new Date(form.publishAt).toISOString(),
      summary: form.summary.trim(),
    });
    onClose();
  }

  return (
    <Modal open={open} title={news ? '编辑资讯' : '新增资讯'} onClose={onClose}>
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>标题</span>
          <input required type="text" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="field">
          <span>来源</span>
          <input type="text" value={form.sourceName} onChange={(event) => setForm({ ...form, sourceName: event.target.value })} />
        </label>
        <label className="field">
          <span>状态</span>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as NewsStatus })}>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">归档</option>
          </select>
        </label>
        <label className="field">
          <span>发布时间</span>
          <input type="datetime-local" value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} />
        </label>
        <label className="field">
          <span>摘要</span>
          <textarea rows={4} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
        </label>
        <div className="button-row button-row--right">
          <Button type="button" onClick={onClose}>取消</Button>
          <Button type="submit" variant="primary">保存</Button>
        </div>
      </form>
    </Modal>
  );
}
