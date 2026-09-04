'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X, CreditCard, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, VendorCreditNote, PurchaseOrder } from '@/types';

export default function CreditNotesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [applying, setApplying] = useState<VendorCreditNote | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-credit-notes', page, status],
    queryFn: async () =>
      (
        await api.get<ApiResponse<VendorCreditNote[]>>('/vendor-credit-notes', {
          params: { page, limit: 10, status: status || undefined },
        })
      ).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vendor-credit-notes'] });

  const apply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.post(`/vendor-credit-notes/${id}/apply`, body),
    onSuccess: () => { toast.success('Credit applied to purchase order'); invalidate(); setApplying(null); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to apply credit'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.patch(`/vendor-credit-notes/${id}/cancel`),
    onSuccess: () => { toast.success('Credit note cancelled'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to cancel'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/vendor-returns" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
            <ArrowLeft size={12} /> Vendor Returns
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Vendor Credit Notes</h1>
          <p className="text-sm text-gray-500">Credit issued by vendors for returned/damaged goods, and how it&apos;s been used against purchase orders</p>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="PARTIALLY_APPLIED">Partially Applied</option>
            <option value="APPLIED">Fully Applied</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Credit Note #</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Return</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading credit notes…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No credit notes found.</td></tr>
              )}
              {data?.data.map((cn) => {
                const remaining = Number(cn.amount) - Number(cn.appliedAmount);
                return (
                  <tr key={cn.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{cn.creditNoteNumber}</td>
                    <td className="px-4 py-3 text-gray-500">{cn.vendor?.name}</td>
                    <td className="px-4 py-3 text-gray-500">{cn.vendorReturn?.returnNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(cn.amount)}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(remaining)}</td>
                    <td className="px-4 py-3"><StatusBadge status={cn.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {['OPEN', 'PARTIALLY_APPLIED'].includes(cn.status) && (
                          <button title="Apply to purchase order" onClick={() => setApplying(cn)} className="rounded-md p-1.5 text-primary-600 hover:bg-primary-50">
                            <CreditCard size={16} />
                          </button>
                        )}
                        {cn.status === 'OPEN' && (
                          <button
                            title="Cancel"
                            onClick={() => { if (confirm('Cancel this credit note?')) cancel.mutate(cn.id); }}
                            className="rounded-md p-1.5 text-danger hover:bg-red-50"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      {applying && (
        <ApplyModal
          creditNote={applying}
          onClose={() => setApplying(null)}
          onSubmit={(body) => apply.mutate({ id: applying.id, body })}
          isLoading={apply.isPending}
        />
      )}
    </div>
  );
}

function ApplyModal({
  creditNote, onClose, onSubmit, isLoading,
}: { creditNote: VendorCreditNote; onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const remaining = Number(creditNote.amount) - Number(creditNote.appliedAmount);
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [amount, setAmount] = useState(remaining);

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchases-for-vendor', creditNote.vendorId],
    queryFn: async () =>
      (await api.get<ApiResponse<PurchaseOrder[]>>('/purchases', { params: { vendorId: creditNote.vendorId, limit: 50 } })).data.data,
  });

  const submit = () => {
    if (!purchaseOrderId) { toast.error('Select a purchase order'); return; }
    if (!amount || amount <= 0 || amount > remaining) { toast.error(`Amount must be between 0 and ${remaining}`); return; }
    onSubmit({ purchaseOrderId, amount });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Apply {creditNote.creditNoteNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm text-gray-500">Remaining balance: <span className="font-semibold text-gray-900">{formatCurrency(remaining)}</span></p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Order *</label>
            <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select purchase order</option>
              {purchaseOrders?.map((po) => <option key={po.id} value={po.id}>{po.poNumber} — {formatCurrency(po.totalAmount)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount to Apply *</label>
            <input type="number" min={0} max={remaining} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={isLoading} onClick={submit}>Apply Credit</Button>
        </div>
      </div>
    </div>
  );
}
