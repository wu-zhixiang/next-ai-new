import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { UserRecord, UserStatus, UserUpdateInput } from '../../types/admin';

interface UserEditorProps {
  readonly open: boolean;
  readonly user: UserRecord | null;
  readonly onClose: () => void;
  readonly onSubmit: (userId: string, input: UserUpdateInput) => void;
}

interface UserFormState {
  readonly nickname: string;
  readonly mobileMasked: string;
  readonly membership: string;
  readonly points: string;
  readonly status: UserStatus;
}

function createInitialState(user: UserRecord | null): UserFormState {
  return {
    nickname: user?.nickname ?? '',
    mobileMasked: user?.mobileMasked ?? '',
    membership: user?.membership ?? '无会员',
    points: String(user?.points ?? 0),
    status: user?.status ?? 'active',
  };
}

export function UserEditor({ onClose, onSubmit, open, user }: UserEditorProps): JSX.Element {
  const [form, setForm] = useState<UserFormState>(() => createInitialState(user));

  useEffect(() => {
    setForm(createInitialState(user));
  }, [user, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!user) {
      return;
    }
    onSubmit(user.id, {
      nickname: form.nickname.trim(),
      points: Number.parseInt(form.points, 10) || 0,
      status: form.status,
    });
    onClose();
  }

  return (
    <Modal open={open} title="编辑用户" onClose={onClose}>
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>昵称</span>
          <input
            required
            type="text"
            value={form.nickname}
            onChange={(event) => setForm({ ...form, nickname: event.target.value })}
          />
        </label>
        <label className="field">
          <span>手机号</span>
          <input
            type="text"
            value={form.mobileMasked}
            disabled
            onChange={(event) => setForm({ ...form, mobileMasked: event.target.value })}
          />
        </label>
        <label className="field">
          <span>会员</span>
          <input
            type="text"
            value={form.membership}
            disabled
            onChange={(event) => setForm({ ...form, membership: event.target.value })}
          />
        </label>
        <label className="field">
          <span>积分</span>
          <input
            min="0"
            type="number"
            value={form.points}
            onChange={(event) => setForm({ ...form, points: event.target.value })}
          />
        </label>
        <label className="field">
          <span>状态</span>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as UserStatus })}
          >
            <option value="active">正常</option>
            <option value="disabled">停用</option>
          </select>
        </label>
        <div className="button-row button-row--right">
          <Button type="button" onClick={onClose}>取消</Button>
          <Button type="submit" variant="primary">保存</Button>
        </div>
      </form>
    </Modal>
  );
}
