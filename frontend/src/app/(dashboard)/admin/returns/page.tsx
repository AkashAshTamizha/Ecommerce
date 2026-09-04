'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Eye, X, CheckCircle2, XCircle, Truck, PackageCheck, Undo2, Send, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, ReturnRequest, ReturnRequestStatus, RefundMethod } from '@/types';

const STATUS_OPTIONS: ReturnRequestStatus[] = [
  'REQUESTED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP',
  'RECEIVED', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_DELIVERED', 'REFUNDED', 'CANCELLED',
];

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: 'ORIGINAL_PAYMENT_METHOD', label: 'Original Payment Method' },
  { value: 'STORE_CREDIT', label: 'Store Credit' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

export default function AdminReturnsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [viewing, setViewing] = useState<ReturnRequest | null>(null);
  const [rejecting, setRejecting] = useState<ReturnRequest | null>(null);
  const [scheduling, setScheduling] = useState<ReturnRequest | null>(null);
  const [refunding, setRefunding] = useState<ReturnRequest | null>(null);
  const [shipping, setShipping] = useState<ReturnRequest | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['return-requests', page, search, status, type],
    queryFn: async () =>
      (
        await api.get<ApiResponse<ReturnRequest[]>>('/return-requests', {
          params: { page, limit: 10, q: search || undefined, status: status || undefined, type: type || undefined },
        })
      ).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['return-requests'] });
  const onErr = (fallback: string) => (err: any) => toast.error(err?.response?.data?.message || fallback);

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/return-requests/${id}/approve`),
    onSuccess: () => { toast.success('Request approved'); invalidate(); },
    onError: onErr('Failed to approve request'),
  });

  const reject = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.patch(`/return-requests/${id}/reject`, { rejectionReason }),
    onSuccess: () => { toast.success('Request rejected'); invalidate(); setRejecting(null); },
    onError: onErr('Failed to reject request'),
  });

  const schedulePickup = useMutation({
    mutationFn: ({ id, pickupScheduledAt }: { id: string; pickupScheduledAt: string }) =>
      api.patch(`/return-requests/${id}/schedule-pickup`, { pickupScheduledAt }),
    onSuccess: () => { toast.success('Pickup scheduled'); invalidate(); setScheduling(null); },
    onError: onErr('Failed to schedule pickup'),
  });

  const markPickedUp = useMutation({
    mutationFn: (id: string) => api.patch(`/return-requests/${id}/mark-picked-up`),
    onSuccess: () => { toast.success('Marked as picked up'); invalidate(); },
    onError: onErr('Failed to update'),
  });

  const markReceived = useMutation({
    mutationFn: (id: string) => api.patch(`/return-requests/${id}/mark-received`),
    onSuccess: () => { toast.success('Marked as received — stock restocked'); invalidate(); },
    onError: onErr('Failed to update'),
  });

  const refund = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/return-requests/${id}/refund`, body),
    onSuccess: () => { toast.success('Refund recorded'); invalidate(); setRefunding(null); },
    onError: onErr('Failed to record refund'),
  });

  const shipReplacement = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/return-requests/${id}/ship-replacement`, body),
    onSuccess: () => { toast.success('Replacement marked as shipped'); invalidate(); setShipping(null); },
    onError: onErr('Failed to ship replacement'),
  });

  const deliverReplacement = useMutation({
    mutationFn: (id: string) => api.patch(`/return-requests/${id}/deliver-replacement`),
    onSuccess: () => { toast.success('Replacement marked as delivered'); invalidate(); },
    onError: onErr('Failed to update'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Customer Returns</h1>
          <p className="text-sm text-gray-500">Return and replacement claims filed by customers against delivered orders</p>
        </div>
        <Link href="/admin/vendor-returns" className="text-sm font-medium text-primary-600 hover:underline">
          View Vendor Returns
        </Link>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by request number..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Types</option>
            <option value="RETURN">Return</option>
            <option value="REPLACEMENT">Replacement</option>
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Request #</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading return requests…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No return requests found.</td></tr>
              )}
              {data?.data.map((ret) => (
                <tr key={ret.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ret.requestNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{ret.order?.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{ret.customer?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{ret.type === 'RETURN' ? 'Return' : 'Replacement'}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{ret.reason.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="px-4 py-3"><StatusBadge status={ret.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title="View" onClick={() => setViewing(ret)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
                        <Eye size={16} />
                      </button>
                      {ret.status === 'REQUESTED' && (
                        <>
                          <button title="Approve" onClick={() => approve.mutate(ret.id)} className="rounded-md p-1.5 text-green-600 hover:bg-green-50">
                            <CheckCircle2 size={16} />
                          </button>
                          <button title="Reject" onClick={() => setRejecting(ret)} className="rounded-md p-1.5 text-danger hover:bg-red-50">
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {ret.status === 'APPROVED' && (
                        <>
                          <button title="Schedule pickup" onClick={() => setScheduling(ret)} className="rounded-md p-1.5 text-primary-600 hover:bg-primary-50">
                            <Truck size={16} />
                          </button>
                          <button title="Reject" onClick={() => setRejecting(ret)} className="rounded-md p-1.5 text-danger hover:bg-red-50">
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {ret.status === 'PICKUP_SCHEDULED' && (
                        <button title="Mark picked up" onClick={() => markPickedUp.mutate(ret.id)} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50">
                          <PackageCheck size={16} />
                        </button>
                      )}
                      {ret.status === 'PICKED_UP' && (
                        <button title="Mark received — restocks inventory" onClick={() => markReceived.mutate(ret.id)} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50">
                          <Undo2 size={16} />
                        </button>
                      )}
                      {ret.status === 'RECEIVED' && ret.type === 'RETURN' && (
                        <button title="Record refund" onClick={() => setRefunding(ret)} className="rounded-md p-1.5 text-green-600 hover:bg-green-50">
                          <RotateCcw size={16} />
                        </button>
                      )}
                      {ret.status === 'RECEIVED' && ret.type === 'REPLACEMENT' && (
                        <button title="Ship replacement" onClick={() => setShipping(ret)} className="rounded-md p-1.5 text-primary-600 hover:bg-primary-50">
                          <Send size={16} />
                        </button>
                      )}
                      {ret.status === 'REPLACEMENT_SHIPPED' && (
                        <button title="Mark delivered" onClick={() => deliverReplacement.mutate(ret.id)} className="rounded-md p-1.5 text-green-600 hover:bg-green-50">
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      {viewing && <ViewReturnModal ret={viewing} onClose={() => setViewing(null)} />}

      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(null)}
          isLoading={reject.isPending}
          onSubmit={(rejectionReason) => reject.mutate({ id: rejecting.id, rejectionReason })}
        />
      )}

      {scheduling && (
        <SchedulePickupModal
          onClose={() => setScheduling(null)}
          isLoading={schedulePickup.isPending}
          onSubmit={(pickupScheduledAt) => schedulePickup.mutate({ id: scheduling.id, pickupScheduledAt })}
        />
      )}

      {refunding && (
        <RefundModal
          ret={refunding}
          onClose={() => setRefunding(null)}
          isLoading={refund.isPending}
          onSubmit={(body) => refund.mutate({ id: refunding.id, body })}
        />
      )}

      {shipping && (
        <ShipReplacementModal
          onClose={() => setShipping(null)}
          isLoading={shipReplacement.isPending}
          onSubmit={(body) => shipReplacement.mutate({ id: shipping.id, body })}
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ViewReturnModal({ ret, onClose }: { ret: ReturnRequest; onClose: () => void }) {
  const total = ret.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  return (
    <ModalShell title={ret.requestNumber} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Status</span>
          <StatusBadge status={ret.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Type</span>
          <span className="font-medium text-gray-900">{ret.type === 'RETURN' ? 'Return for Refund' : 'Replacement'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Reason</span>
          <span className="font-medium capitalize text-gray-900">{ret.reason.replace(/_/g, ' ').toLowerCase()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Order</span>
          <Link href={`/admin/orders`} className="font-medium text-primary-600 hover:underline">{ret.order?.orderNumber}</Link>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Customer</span>
          <span className="font-medium text-gray-900">{ret.customer?.name} ({ret.customer?.email})</span>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 font-medium text-gray-900">Items</p>
          <div className="space-y-2">
            {ret.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-gray-600">
                <span>{item.orderItem?.product?.name} × {item.quantity}</span>
                <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 font-semibold text-gray-900">
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
        </div>

        {ret.customerNotes && (
          <div className="border-t border-gray-100 pt-3">
            <p className="mb-1 font-medium text-gray-900">Customer notes</p>
            <p className="text-gray-600">{ret.customerNotes}</p>
          </div>
        )}
        {ret.rejectionReason && (
          <div className="border-t border-gray-100 pt-3">
            <p className="mb-1 font-medium text-gray-900">Rejection reason</p>
            <p className="text-gray-600">{ret.rejectionReason}</p>
          </div>
        )}
        {ret.refundAmount != null && (
          <div className="border-t border-gray-100 pt-3">
            <p className="font-medium text-gray-900">Refunded {formatCurrency(ret.refundAmount)} via {ret.refundMethod?.replace(/_/g, ' ').toLowerCase()}</p>
          </div>
        )}
        {ret.replacementTrackingNumber && (
          <div className="border-t border-gray-100 pt-3">
            <p className="font-medium text-gray-900">{ret.replacementCourierName} · Tracking #{ret.replacementTrackingNumber}</p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function RejectModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (reason: string) => void; isLoading: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <ModalShell title="Reject Request" onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-gray-700">Reason for rejection *</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        placeholder="Explain why this claim is being rejected…"
      />
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!reason.trim()} isLoading={isLoading} onClick={() => onSubmit(reason.trim())}>Reject</Button>
      </div>
    </ModalShell>
  );
}

function SchedulePickupModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (date: string) => void; isLoading: boolean }) {
  const [date, setDate] = useState('');
  return (
    <ModalShell title="Schedule Pickup" onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-gray-700">Pickup date *</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!date} isLoading={isLoading} onClick={() => onSubmit(new Date(date).toISOString())}>Schedule</Button>
      </div>
    </ModalShell>
  );
}

function RefundModal({ ret, onClose, onSubmit, isLoading }: { ret: ReturnRequest; onClose: () => void; onSubmit: (body: any) => void; isLoading: boolean }) {
  const suggested = ret.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] = useState<RefundMethod>('ORIGINAL_PAYMENT_METHOD');
  return (
    <ModalShell title="Record Refund" onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-gray-700">Refund amount *</label>
      <input
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <label className="mb-1 block text-sm font-medium text-gray-700">Refund method *</label>
      <select value={method} onChange={(e) => setMethod(e.target.value as RefundMethod)} className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
        {REFUND_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!amount || Number(amount) <= 0} isLoading={isLoading} onClick={() => onSubmit({ refundAmount: Number(amount), refundMethod: method })}>
          Confirm Refund
        </Button>
      </div>
    </ModalShell>
  );
}

function ShipReplacementModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (body: any) => void; isLoading: boolean }) {
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  return (
    <ModalShell title="Ship Replacement" onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-gray-700">Courier name</label>
      <input
        value={courierName}
        onChange={(e) => setCourierName(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        placeholder="e.g. Delhivery"
      />
      <label className="mb-1 block text-sm font-medium text-gray-700">Tracking number</label>
      <input
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <p className="mb-4 text-xs text-gray-400">This deducts fresh stock for the replacement unit(s) from the warehouse.</p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button isLoading={isLoading} onClick={() => onSubmit({ courierName: courierName || undefined, trackingNumber: trackingNumber || undefined })}>
          Mark as Shipped
        </Button>
      </div>
    </ModalShell>
  );
}
