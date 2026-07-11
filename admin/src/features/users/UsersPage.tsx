import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useRemoteItems } from '../../hooks/useRemoteItems';
import type { UserRecord, UserStatus, UserUpdateInput } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { getUserStatusMeta } from '../shared/statusMeta';
import { UserEditor } from './UserEditor';

export function UsersPage(): JSX.Element {
  const api = useAdminApi();
  const loader = useCallback(() => api.listUsers(), [api]);
  const remote = useRemoteItems<UserRecord>('admin.users', loader);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<UserStatus | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredUsers = useMemo(() => remote.items.filter((user) => {
    const keywordMatched = [user.nickname, user.mobileMasked, user.membership].some((value) => (
      value.toLowerCase().includes(keyword.trim().toLowerCase())
    ));
    const statusMatched = status === 'all' || user.status === status;
    return keywordMatched && statusMatched;
  }), [remote.items, keyword, status]);

  function openEditor(user: UserRecord): void {
    setSelectedUser(user);
    setEditorOpen(true);
  }

  async function submitUser(userId: string, input: UserUpdateInput): Promise<void> {
    setIsMutating(true);
    setActionError('');
    try {
      const nextItems = await api.updateUser(userId, input);
      remote.setItems(nextItems);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存用户失败');
    } finally {
      setIsMutating(false);
    }
  }

  async function confirmDeleteUser(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
      setActionError('');
      try {
        await api.deleteUser(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除用户失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<UserRecord>[] = [
    {
      id: 'nickname',
      header: '用户',
      cell: (row) => <strong>{row.nickname}</strong>,
    },
    {
      id: 'mobile',
      header: '手机号',
      cell: (row) => row.mobileMasked,
    },
    {
      id: 'membership',
      header: '会员',
      cell: (row) => row.membership,
    },
    {
      id: 'points',
      header: '积分',
      align: 'right',
      cell: (row) => row.points,
    },
    {
      id: 'status',
      header: '状态',
      cell: (row) => {
        const meta = getUserStatusMeta(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      id: 'lastActiveAt',
      header: '最近活跃',
      cell: (row) => formatDateTime(row.lastActiveAt),
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => openEditor(row)} aria-label="编辑用户" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除用户" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="用户管理"
        description="用户资料、会员状态、积分与账号状态"
      />

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索用户</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="昵称 / 手机 / 会员" />
          </label>
          <label className="select-field">
            <span>状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | 'all')}>
              <option value="all">全部</option>
              <option value="active">正常</option>
              <option value="disabled">停用</option>
            </select>
          </label>
        </div>
        {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
        <PanelState
          errorMessage={remote.errorMessage}
          isEmpty={filteredUsers.length === 0}
          isLoading={remote.isLoading}
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredUsers} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <UserEditor
        open={editorOpen}
        user={selectedUser}
        onClose={() => setEditorOpen(false)}
        onSubmit={(userId, input) => void submitUser(userId, input)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除用户"
        description={`确认删除用户「${deleteTarget?.nickname ?? ''}」？删除后该用户后台记录将从云数据库移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteUser()}
      />
    </div>
  );
}
