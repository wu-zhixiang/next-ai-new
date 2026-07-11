import { Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { useAdminApi } from '../../hooks/useAdminApi';
import type { InviteMilestoneConfig, PointsConfigInput, PointsConfigRecord } from '../../types/admin';
import { formatDateTime } from '../../utils/format';

interface MilestoneFormState {
  readonly id: string;
  readonly inviteCount: string;
  readonly rewardPoints: string;
  readonly enabled: boolean;
  readonly description: string;
}

interface PointsConfigFormState {
  readonly pointsPerYuan: string;
  readonly inviteBaseRewardPoints: string;
  readonly inviteMilestones: readonly MilestoneFormState[];
}

const DEFAULT_POINTS_PER_YUAN = 10;
const DEFAULT_INVITE_BASE_REWARD_POINTS = 5;

function createEmptyForm(): PointsConfigFormState {
  return {
    pointsPerYuan: String(DEFAULT_POINTS_PER_YUAN),
    inviteBaseRewardPoints: String(DEFAULT_INVITE_BASE_REWARD_POINTS),
    inviteMilestones: [],
  };
}

function toSafeNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function createMilestoneId(inviteCount: number): string {
  return `invite_${inviteCount || Date.now()}`;
}

function createFormFromConfig(config: PointsConfigRecord): PointsConfigFormState {
  return {
    pointsPerYuan: String(config.pointsPerYuan || DEFAULT_POINTS_PER_YUAN),
    inviteBaseRewardPoints: String(Number.isFinite(config.inviteBaseRewardPoints) ? config.inviteBaseRewardPoints : DEFAULT_INVITE_BASE_REWARD_POINTS),
    inviteMilestones: config.inviteMilestones.map((milestone) => ({
      id: milestone.id,
      inviteCount: String(milestone.inviteCount),
      rewardPoints: String(milestone.rewardPoints),
      enabled: milestone.enabled,
      description: milestone.description ?? '',
    })),
  };
}

function toMilestoneInput(value: MilestoneFormState): InviteMilestoneConfig | null {
  const inviteCount = Math.max(1, toSafeNumber(value.inviteCount, 1));
  const rewardPoints = toSafeNumber(value.rewardPoints, 0);
  if (rewardPoints <= 0) {
    return null;
  }
  return {
    id: value.id || createMilestoneId(inviteCount),
    inviteCount,
    rewardPoints,
    enabled: value.enabled,
    description: value.description.trim(),
  };
}

function buildInput(form: PointsConfigFormState): PointsConfigInput {
  const milestones = form.inviteMilestones
    .map(toMilestoneInput)
    .filter((item): item is InviteMilestoneConfig => Boolean(item))
    .sort((left, right) => left.inviteCount - right.inviteCount);
  return {
    pointsPerYuan: Math.max(1, toSafeNumber(form.pointsPerYuan, DEFAULT_POINTS_PER_YUAN)),
    inviteBaseRewardPoints: toSafeNumber(form.inviteBaseRewardPoints, DEFAULT_INVITE_BASE_REWARD_POINTS),
    inviteMilestones: milestones,
  };
}

export function PointsConfigPage(): JSX.Element {
  const api = useAdminApi();
  const [form, setForm] = useState<PointsConfigFormState>(createEmptyForm);
  const [updatedAt, setUpdatedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MilestoneFormState | null>(null);

  const ratioPreview = useMemo(() => {
    const pointsPerYuan = Math.max(1, toSafeNumber(form.pointsPerYuan, DEFAULT_POINTS_PER_YUAN));
    return `${pointsPerYuan} 积分 = 1 元`;
  }, [form.pointsPerYuan]);

  const loadConfig = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const config = await api.getPointsConfig();
      setForm(createFormFromConfig(config));
      setUpdatedAt(config.updatedAt);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '积分配置读取失败');
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
      const config = await api.updatePointsConfig(buildInput(form));
      setForm(createFormFromConfig(config));
      setUpdatedAt(config.updatedAt);
      setSuccessMessage('积分配置已保存');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '积分配置保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  function addMilestone(): void {
    const nextInviteCount = form.inviteMilestones.length > 0
      ? Math.max(...form.inviteMilestones.map((milestone) => toSafeNumber(milestone.inviteCount, 0))) + 10
      : 10;
    const nextMilestone: MilestoneFormState = {
      id: createMilestoneId(nextInviteCount),
      inviteCount: String(nextInviteCount),
      rewardPoints: '50',
      enabled: true,
      description: '',
    };
    setForm((current) => ({
      ...current,
      inviteMilestones: [...current.inviteMilestones, nextMilestone],
    }));
  }

  function updateMilestone(id: string, patch: Partial<MilestoneFormState>): void {
    setForm((current) => ({
      ...current,
      inviteMilestones: current.inviteMilestones.map((milestone) => (
        milestone.id === id ? { ...milestone, ...patch } : milestone
      )),
    }));
  }

  function confirmDeleteMilestone(): void {
    if (!deleteTarget) {
      return;
    }
    setForm((current) => ({
      ...current,
      inviteMilestones: current.inviteMilestones.filter((milestone) => milestone.id !== deleteTarget.id),
    }));
    setDeleteTarget(null);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="积分配置"
        description="配置积分抵扣比例、邀请基础奖励和累计邀请阶梯奖励"
        actions={(
          <Button icon={<Plus size={16} strokeWidth={2} />} onClick={addMilestone}>
            新增阶梯
          </Button>
        )}
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
                <h2>抵扣规则</h2>
                <span>{updatedAt ? `最后保存：${formatDateTime(updatedAt)}` : ratioPreview}</span>
              </div>
              <div className="form-grid form-grid--four">
                <label className="field">
                  <span>每 1 元需要积分</span>
                  <input
                    min="1"
                    type="number"
                    value={form.pointsPerYuan}
                    onChange={(event) => setForm({ ...form, pointsPerYuan: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>邀请 1 人奖励积分</span>
                  <input
                    min="0"
                    type="number"
                    value={form.inviteBaseRewardPoints}
                    onChange={(event) => setForm({ ...form, inviteBaseRewardPoints: event.target.value })}
                  />
                </label>
                <div className="field field--wide">
                  <span>当前换算</span>
                  <strong>{ratioPreview}</strong>
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section__header">
                <h2>邀请阶梯</h2>
                <span>达到累计邀请人数后自动发放一次</span>
              </div>
              {form.inviteMilestones.length > 0 ? (
                <div className="stack-list">
                  {form.inviteMilestones.map((milestone) => (
                    <div className="form-grid form-grid--four" key={milestone.id}>
                      <label className="field">
                        <span>累计邀请人数</span>
                        <input
                          min="1"
                          type="number"
                          value={milestone.inviteCount}
                          onChange={(event) => updateMilestone(milestone.id, { inviteCount: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>赠送积分</span>
                        <input
                          min="1"
                          type="number"
                          value={milestone.rewardPoints}
                          onChange={(event) => updateMilestone(milestone.id, { rewardPoints: event.target.value })}
                        />
                      </label>
                      <label className="field field--wide">
                        <span>说明</span>
                        <input
                          value={milestone.description}
                          onChange={(event) => updateMilestone(milestone.id, { description: event.target.value })}
                          placeholder={`累计邀请${milestone.inviteCount || 10}人奖励${milestone.rewardPoints || 0}积分`}
                        />
                      </label>
                      <label className="check-field">
                        <input
                          checked={milestone.enabled}
                          type="checkbox"
                          onChange={(event) => updateMilestone(milestone.id, { enabled: event.target.checked })}
                        />
                        <span>启用</span>
                      </label>
                      <div className="table-actions">
                        <button
                          aria-label="删除阶梯"
                          className="icon-button icon-button--danger"
                          onClick={() => setDeleteTarget(milestone)}
                          title="删除"
                          type="button"
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>暂无邀请阶梯</strong>
                  <span>只发放每邀请 1 人的基础积分奖励。</span>
                </div>
              )}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除阶梯"
        description={`确认删除「累计邀请 ${deleteTarget?.inviteCount ?? ''} 人」这条阶梯？保存配置后生效。`}
        isWorking={false}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteMilestone}
      />
    </div>
  );
}
