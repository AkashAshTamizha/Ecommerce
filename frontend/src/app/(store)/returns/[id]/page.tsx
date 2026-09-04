'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, Circle, Package, XCircle, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, ReturnRequest, ReturnRequestStatus } from '@/types';

const RETURN_STEPS: { status: ReturnRequestStatus; label: string }[] = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
  { status: 'PICKED_UP', label: 'Picked Up' },
  { status: 'RECEIVED', label: 'Received at Warehouse' },
  { status: 'REFUNDED', label: 'Refunded' },
];

const REPLACEMENT_STEPS: { status: ReturnRequestStatus; label: string }[] = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
  { status: 'PICKED_UP', label: 'Picked Up' },
  { status: 'RECEIVED', label: 'Received at Warehouse' },
  { status: 'REPLACEMENT_SHIPPED', label: 'Replacement Shipped' },
  { status: 'REPLACEMENT_DELIVERED', label: 'Replacement Delivered' },
];

export default function MyReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: ret, isLoading } = useQuery({
    queryKey: ['return-request', params.id],
    queryFn: async () => (await api.get<ApiResponse<ReturnRequest>>(`/return-requests/${params.id}`)).data.data,
  });

  const cancel = useMutation({
    mutationFn: () => api.patch(`/return-requests/${params.id}/cancel`),
    onSuccess: () => { toast.success('Request cancelled'); qc.invalidateQueries({ queryKey: ['return-request', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not cancel request'),
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-6">Loading request…</div>;
  if (!ret) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-6">Return request not found.</div>;

  const steps = ret.type === 'RETURN' ? RETURN_STEPS : REPLACEMENT_STEPS;
  const isTerminalStop = ret.status === 'REJECTED' || ret.status === 'CANCELLED';
  const currentIdx = steps.findIndex((s) => s.status === ret.status);
  const total = ret.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{ret.requestNumber}</h1>
          <p className="text-sm text-gray-400">
            {ret.type === 'RETURN' ? 'Return' : 'Replacement'} for order{' '}
            <Link href={`/orders/${ret.orderId}`} className="text-primary-600 hover:underline">{ret.order?.orderNumber}</Link>
          </p>
        </div>
        <StatusBadge status={ret.status} />
      </div>

      {isTerminalStop && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-white p-5 shadow-sm">
          {ret.status === 'REJECTED' ? <XCircle size={20} className="mt-0.5 shrink-0 text-red-500" /> : <Ban size={20} className="mt-0.5 shrink-0 text-gray-400" />}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {ret.status === 'REJECTED' ? 'This request was rejected' : 'This request was cancelled'}
            </p>
            {ret.rejectionReason && <p className="mt-1 text-sm text-gray-500">{ret.rejectionReason}</p>}
          </div>
        </div>
      )}

      {!isTerminalStop && (
        <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Status</h2>
          <div className="space-y-4">
            {steps.map((step, idx) => {
              const done = idx <= currentIdx;
              return (
                <div key={step.status} className="flex items-center gap-3 text-sm">
                  {done ? <CheckCircle2 size={18} className="shrink-0 text-green-500" /> : <Circle size={18} className="shrink-0 text-gray-300" />}
                  <span className={done ? 'font-medium text-gray-900' : 'text-gray-400'}>{step.label}</span>
                </div>
              );
            })}
          </div>
          {ret.type === 'REPLACEMENT' && ret.replacementTrackingNumber && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">
              {ret.replacementCourierName} · Tracking #{ret.replacementTrackingNumber}
            </p>
          )}
          {ret.type === 'RETURN' && ret.refundAmount != null && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">
              Refunded {formatCurrency(ret.refundAmount)} via {ret.refundMethod?.replace(/_/g, ' ').toLowerCase()}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Package size={16} /> Items in this request</h2>
        <div className="divide-y divide-gray-100">
          {ret.items.map((item) => {
            const image = item.orderItem?.product?.images?.[0]?.url;
            return (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.orderItem?.product?.name}</p>
                  <p className="text-xs text-gray-400">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(item.unitPrice * item.quantity)}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
          <span>Total</span><span>{formatCurrency(total)}</span>
        </div>
        {ret.customerNotes && (
          <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600"><span className="font-medium text-gray-900">Your note: </span>{ret.customerNotes}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Link href="/returns" className="text-sm font-medium text-primary-600 hover:text-primary-700">← Back to returns</Link>
        {ret.status === 'REQUESTED' && (
          <Button variant="danger" onClick={() => cancel.mutate()} isLoading={cancel.isPending}>
            <XCircle size={16} /> Cancel Request
          </Button>
        )}
      </div>
    </div>
  );
}
