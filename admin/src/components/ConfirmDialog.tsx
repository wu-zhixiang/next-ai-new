import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmText?: string;
  readonly isWorking?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmDialog({
  confirmText = '确认删除',
  description,
  isWorking = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal open={open} title={title} onClose={isWorking ? () => undefined : onCancel}>
      <div className="confirm-body">
        <div className="confirm-icon" aria-hidden="true">
          <AlertTriangle size={22} strokeWidth={2} />
        </div>
        <p>{description}</p>
      </div>
      <div className="button-row button-row--right modal-actions">
        <Button type="button" disabled={isWorking} onClick={onCancel}>取消</Button>
        <Button type="button" disabled={isWorking} variant="danger" onClick={onConfirm}>
          {isWorking ? '处理中' : confirmText}
        </Button>
      </div>
    </Modal>
  );
}
