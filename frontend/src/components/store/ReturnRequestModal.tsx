'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import type { Order, ReturnRequestReason, ReturnRequestType } from '@/types';

const REASONS: { value: ReturnRequestReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Item arrived damaged' },
  { value: 'DEFECTIVE', label: "Item doesn't work / defective" },
  { value: 'WRONG_ITEM', label: 'Received the wrong item' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'SIZE_FIT_ISSUE', label: "Size or fit isn't right" },
  { value: 'NO_LONGER_NEEDED', label: 'No longer needed' },
  { value: 'QUALITY_ISSUE', label: 'Quality issue' },
  { value: 'OTHER', label: 'Other' },
];

interface Props {
  order: Order;
  onClose: () => void;
  onSubmit: (body: any) => void;
  isLoading: boolean;
}

export function ReturnRequestModal({ order, onClose, onSubmit, isLoading }: Props) {
  const [type, setType] = useState<ReturnRequestType>('RETURN');
  const [reason, setReason] = useState<ReturnRequestReason>('DAMAGED');
  const [customerNotes, setCustomerNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, { checked: boolean; quantity: number }>>(
    Object.fromEntries((order.items || []).map((it) => [it.id, { checked: false, quantity: it.quantity }]))
  );

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));
  const setQty = (id: string, quantity: number) => setSelected((prev) => ({ ...prev, [id]: { ...prev[id], quantity } }));

  const chosenItems = (order.items || []).filter((it) => selected[it.id]?.checked);
  const estimatedTotal = chosenItems.reduce((sum, it) => sum + it.price * (selected[it.id]?.quantity || 0), 0);

  const submit = () => {
    if (chosenItems.length === 0) return;
    onSubmit({
      orderId: order.id,
      type,
      reason,
      customerNotes: customerNotes || undefined,
      items: chosenItems.map((it) => ({ orderItemId: it.id, quantity: selected[it.id].quantity })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Return or Replace</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['RETURN', 'REPLACEMENT'] as ReturnRequestType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                type === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'RETURN' ? 'Return for Refund' : 'Replace Item'}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Which items?</p>
          <div className="space-y-2">
            {(order.items || []).map((item) => {
              const image = item.product?.images?.[0]?.url;
              const sel = selected[item.id];
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
                  <input type="checkbox" checked={sel?.checked || false} onChange={() => toggle(item.id)} className="h-4 w-4" />
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-50">
                    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.product?.name}</p>
                    <p className="text-xs text-gray-400">Ordered {item.quantity} · {formatCurrency(item.price)} each</p>
                  </div>
                  {sel?.checked && (
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={sel.quantity}
                      onChange={(e) => setQty(item.id, Math.min(item.quantity, Math.max(1, Number(e.target.value))))}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Reason *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as ReturnRequestReason)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Additional details (optional)</label>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Tell us more about the issue…"
          />
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            Est. {type === 'RETURN' ? 'refund' : 'value'}: <span className="font-semibold text-gray-900">{formatCurrency(estimatedTotal)}</span>
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button isLoading={isLoading} disabled={chosenItems.length === 0} onClick={submit}>Submit Request</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
