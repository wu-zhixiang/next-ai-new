import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  readonly children: ReactNode;
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}

export function Modal({ children, onClose, open, title }: ModalProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭" title="关闭">
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
