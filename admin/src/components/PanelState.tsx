import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface PanelStateProps {
  readonly errorMessage: string;
  readonly isLoading: boolean;
  readonly isEmpty: boolean;
  readonly emptyText?: string;
  readonly onRetry: () => void;
}

export function PanelState({
  emptyText = '暂无数据',
  errorMessage,
  isEmpty,
  isLoading,
  onRetry,
}: PanelStateProps): JSX.Element | null {
  if (isLoading) {
    return <div className="panel-state" role="status">正在加载真实云端数据...</div>;
  }

  if (errorMessage) {
    return (
      <div className="panel-state panel-state--error" role="alert">
        <span>{errorMessage}</span>
        <Button size="sm" icon={<RefreshCw size={14} strokeWidth={2} />} onClick={onRetry}>重试</Button>
      </div>
    );
  }

  if (isEmpty) {
    return <div className="panel-state" role="status">{emptyText}</div>;
  }

  return null;
}
