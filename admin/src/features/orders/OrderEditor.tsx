import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import type { OrderRecord, OrderStatus, OrderUpdateInput } from '../../types/admin';

interface OrderEditorProps {
  readonly open: boolean;
  readonly order: OrderRecord | null;
  readonly onClose: () => void;
  readonly onSubmit: (orderId: string, input: OrderUpdateInput) => void;
}

interface OrderFormState {
  readonly orderNo: string;
  readonly userName: string;
  readonly productName: string;
  readonly amountYuan: string;
  readonly status: OrderStatus;
  readonly fulfillmentStatus: string;
}

function createInitialState(order: OrderRecord | null): OrderFormState {
  return {
    orderNo: order?.orderNo ?? '',
    userName: order?.userName ?? '',
    productName: order?.productName ?? 'AI 会员月卡',
    amountYuan: String((order?.amountCents ?? 0) / 100),
    status: order?.status ?? 'pending',
    fulfillmentStatus: order?.fulfillmentStatus ?? '待处理',
  };
}

export function OrderEditor({ onClose, onSubmit, open, order }: OrderEditorProps): JSX.Element {
  const [form, setForm] = useState<OrderFormState>(() => createInitialState(order));

  useEffect(() => {
    setForm(createInitialState(order));
  }, [order, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!order) {
      return;
    }
    onSubmit(order.id, {
      productName: form.productName.trim(),
      amountCents: Math.round((Number.parseFloat(form.amountYuan) || 0) * 100),
      status: form.status,
      fulfillmentStatus: form.fulfillmentStatus.trim(),
    });
    onClose();
  }

  return (
    <Modal open={open} title="编辑订单" onClose={onClose}>
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>订单号</span>
          <input
            type="text"
            value={form.orderNo}
            disabled
            onChange={(event) => setForm({ ...form, orderNo: event.target.value })}
          />
        </label>
        <label className="field">
          <span>用户</span>
          <input
            type="text"
            value={form.userName}
            disabled
            onChange={(event) => setForm({ ...form, userName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>产品</span>
          <input
            required
            type="text"
            value={form.productName}
            onChange={(event) => setForm({ ...form, productName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>金额</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.amountYuan}
            onChange={(event) => setForm({ ...form, amountYuan: event.target.value })}
          />
        </label>
        <label className="field">
          <span>订单状态</span>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as OrderStatus })}>
            <option value="pending">待支付</option>
            <option value="paid">已支付</option>
            <option value="fulfilled">已交付</option>
            <option value="refunded">已退款</option>
            <option value="closed">已关闭</option>
          </select>
        </label>
        <label className="field">
          <span>交付状态</span>
          <input
            type="text"
            value={form.fulfillmentStatus}
            onChange={(event) => setForm({ ...form, fulfillmentStatus: event.target.value })}
          />
        </label>
        <div className="button-row button-row--right">
          <Button type="button" onClick={onClose}>取消</Button>
          <Button type="submit" variant="primary">保存</Button>
        </div>
      </form>
    </Modal>
  );
}
