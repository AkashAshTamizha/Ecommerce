'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, X, Send, CheckCircle2, Ban, Trash2, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, VendorReturn, Vendor, Warehouse, Product, VendorReturnReason, VendorReturnResolution } from '@/types';

const REASONS: VendorReturnReason[] = ['DAMAGED', 'DEFECTIVE', 'EXPIRED', 'WRONG_ITEM', 'EXCESS_SUPPLY', 'QUALITY_ISSUE', 'OTHER'];
const RESOLUTIONS: { value: VendorReturnResolution; label: string }[] = [
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
  { value: 'REPLACEMENT', label: 'Replacement Stock' },
  { value: 'REFUND', label: 'Cash Refund' },
  { value: 'REJECTED', label: 'Vendor Rejected Claim' },
];

export default function VendorReturnsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<VendorReturn | null>(null);
  const [resolving, setResolving] = useState<VendorReturn | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-returns', page, search, status],
    queryFn: async () =>
      (
        await api.get<ApiResponse<VendorReturn[]>>('/vendor-returns', {
          params: { page, limit: 10, q: search || undefined, status: status || undefined },
        })
      ).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vendor-returns'] });

  const create = useMutation({
    mutationFn: (body: any) => api.post('/vendor-returns', body),
    onSuccess: () => { toast.success('Vendor return created'); invalidate(); setShowCreate(false); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create return'),
  });

  const send = useMutation({
    mutationFn: (id: string) => api.patch(`/vendor-returns/${id}/send`),
    onSuccess: () => { toast.success('Marked as sent to vendor'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => api.patch(`/vendor-returns/${id}/acknowledge`),
    onSuccess: () => { toast.success('Vendor acknowledged the return'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  });

  const resolve = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.post(`/vendor-returns/${id}/resolve`, body),
    onSuccess: () => { toast.success('Return resolved'); invalidate(); setResolving(null); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to resolve return'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.patch(`/vendor-returns/${id}/cancel`),
    onSuccess: () => { toast.success('Return cancelled'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to cancel'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/vendor-returns/${id}`),
    onSuccess: () => { toast.success('Draft return deleted'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendor Returns</h1>
          <p className="text-sm text-gray-500">Damaged or defective stock sent back to vendors, and how each was resolved</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/credit-notes" className="text-sm font-medium text-primary-600 hover:underline">
            View Credit Notes
          </Link>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Return
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by return number..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT_TO_VENDOR">Sent to Vendor</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Return #</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Warehouse</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Resolution</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading vendor returns…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No vendor returns found.</td></tr>
              )}
              {data?.data.map((ret) => (
                <tr key={ret.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ret.returnNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{ret.vendor?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{ret.warehouse?.name}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{ret.reason.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(ret.totalValue)}</td>
                  <td className="px-4 py-3"><StatusBadge status={ret.status} /></td>
                  <td className="px-4 py-3">
                    {ret.resolution === 'PENDING' ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <StatusBadge status={ret.resolution} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title="View" onClick={() => setViewing(ret)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
                        <Eye size={16} />
                      </button>
                      {ret.status === 'DRAFT' && (
                        <button
                          title="Send to vendor"
                          onClick={() => send.mutate(ret.id)}
                          className="rounded-md p-1.5 text-primary-600 hover:bg-primary-50"
                        >
                          <Send size={16} />
                        </button>
                      )}
                      {ret.status === 'SENT_TO_VENDOR' && (
                        <button
                          title="Mark acknowledged"
                          onClick={() => acknowledge.mutate(ret.id)}
                          className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                        >
                          <ClipboardCheck size={16} />
                        </button>
                      )}
                      {(ret.status === 'SENT_TO_VENDOR' || ret.status === 'ACKNOWLEDGED') && (
                        <button
                          title="Resolve"
                          onClick={() => setResolving(ret)}
                          className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {!['RESOLVED', 'CANCELLED'].includes(ret.status) && (
                        <button
                          title="Cancel"
                          onClick={() => { if (confirm('Cancel this vendor return? Any stock already sent out will be restocked.')) cancel.mutate(ret.id); }}
                          className="rounded-md p-1.5 text-danger hover:bg-red-50"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                      {ret.status === 'DRAFT' && (
                        <button
                          title="Delete draft"
                          onClick={() => { if (confirm('Delete this draft return?')) remove.mutate(ret.id); }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-danger"
                        >
                          <Trash2 size={16} />
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

      {showCreate && (
        <CreateReturnModal onClose={() => setShowCreate(false)} onSubmit={(body) => create.mutate(body)} isLoading={create.isPending} />
      )}

      {viewing && <ViewReturnModal vendorReturn={viewing} onClose={() => setViewing(null)} />}

      {resolving && (
        <ResolveModal
          vendorReturn={resolving}
          onClose={() => setResolving(null)}
          onSubmit={(body) => resolve.mutate({ id: resolving.id, body })}
          isLoading={resolve.isPending}
        />
      )}
    </div>
  );
}

function CreateReturnModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState<VendorReturnReason>('DAMAGED');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantity: 1, unitCost: 0, condition: '' }]);

  const { data: vendors } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => (await api.get<ApiResponse<Vendor[]>>('/vendors', { params: { limit: 100 } })).data.data,
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => (await api.get<ApiResponse<Warehouse[]>>('/warehouses', { params: { limit: 100 } })).data.data,
  });
  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => (await api.get<ApiResponse<Product[]>>('/products', { params: { limit: 100 } })).data.data,
  });

  const updateLine = (idx: number, field: string, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const total = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);

  const submit = () => {
    if (!vendorId || !warehouseId) { toast.error('Vendor and warehouse are required'); return; }
    const items = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (items.length === 0) { toast.error('Add at least one valid line item'); return; }
    onSubmit({ vendorId, warehouseId, reason, notes: notes || undefined, items });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">New Vendor Return</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Vendor *</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select vendor</option>
              {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Warehouse *</label>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select warehouse</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value as VendorReturnReason)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Damaged / Returned Items</label>
            <button
              onClick={() => setLines([...lines, { productId: '', quantity: 1, unitCost: 0, condition: '' }])}
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              + Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={line.productId}
                  onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                  className="col-span-4 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="">Select product</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input
                  type="number" min={1} value={line.quantity}
                  onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="col-span-2 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
                <input
                  type="number" min={0} value={line.unitCost}
                  onChange={(e) => updateLine(idx, 'unitCost', e.target.value)}
                  placeholder="Unit cost"
                  className="col-span-2 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
                <input
                  value={line.condition}
                  onChange={(e) => updateLine(idx, 'condition', e.target.value)}
                  placeholder="Condition notes"
                  className="col-span-3 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
                <button
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  className="col-span-1 flex justify-center text-gray-400 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">Total value: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span></p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button isLoading={isLoading} onClick={submit}>Create Return</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewReturnModal({ vendorReturn, onClose }: { vendorReturn: VendorReturn; onClose: () => void }) {
  // The list endpoint only returns a lightweight row (with `_count.items`,
  // not the actual `items` array), so fetch the full record with items and
  // credit notes now that the user wants to see the detail view.
  const { data: full, isLoading } = useQuery({
    queryKey: ['vendor-return', vendorReturn.id],
    queryFn: async () => (await api.get<ApiResponse<VendorReturn>>(`/vendor-returns/${vendorReturn.id}`)).data.data,
    initialData: vendorReturn.items ? vendorReturn : undefined,
  });

  const ret = full || vendorReturn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{ret.returnNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-500">Vendor</p><p className="text-gray-900">{ret.vendor?.name}</p>
          <p className="text-gray-500">Warehouse</p><p className="text-gray-900">{ret.warehouse?.name}</p>
          <p className="text-gray-500">Reason</p><p className="text-gray-900 capitalize">{ret.reason.replace(/_/g, ' ').toLowerCase()}</p>
          <p className="text-gray-500">Status</p><p><StatusBadge status={ret.status} /></p>
          <p className="text-gray-500">Resolution</p><p>{ret.resolution === 'PENDING' ? '—' : <StatusBadge status={ret.resolution} />}</p>
          <p className="text-gray-500">Total Value</p><p className="text-gray-900">{formatCurrency(ret.totalValue)}</p>
          {ret.notes && (<><p className="text-gray-500">Notes</p><p className="text-gray-900">{ret.notes}</p></>)}
        </div>
        {isLoading && !full ? (
          <p className="border-t border-gray-100 py-4 text-center text-sm text-gray-400">Loading items…</p>
        ) : (
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {(ret.items || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{item.product?.name}</p>
                  <p className="text-xs text-gray-400">{item.product?.sku}{item.condition ? ` · ${item.condition}` : ''}</p>
                </div>
                <p className="text-gray-500">Qty {item.quantity}</p>
                <p className="text-gray-900">{formatCurrency(item.totalCost)}</p>
              </div>
            ))}
          </div>
        )}
        {!!ret.creditNotes?.length && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-2 text-sm font-medium text-gray-700">Credit Notes Issued</p>
            {ret.creditNotes.map((cn) => (
              <div key={cn.id} className="flex items-center justify-between text-sm text-gray-600">
                <span>{cn.creditNoteNumber}</span>
                <span>{formatCurrency(cn.amount)}</span>
                <StatusBadge status={cn.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResolveModal({
  vendorReturn, onClose, onSubmit, isLoading,
}: { vendorReturn: VendorReturn; onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [resolution, setResolution] = useState<VendorReturnResolution>('CREDIT_NOTE');
  const [amount, setAmount] = useState(vendorReturn.totalValue);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const submit = () => {
    if (resolution === 'CREDIT_NOTE') {
      if (!amount || amount <= 0) { toast.error('Credit note amount must be greater than zero'); return; }
      onSubmit({ resolution, creditNote: { amount, expiryDate: expiryDate || undefined, notes: notes || undefined } });
    } else {
      onSubmit({ resolution });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Resolve {vendorReturn.returnNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">How did the vendor respond? *</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value as VendorReturnResolution)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {resolution === 'CREDIT_NOTE' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Credit Note Amount *</label>
                <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Date</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </>
          )}
          {resolution === 'REPLACEMENT' && (
            <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              Marking this resolved will restock the original quantities into {vendorReturn.warehouse?.name} as replacement stock received.
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={isLoading} onClick={submit}>Confirm Resolution</Button>
        </div>
      </div>
    </div>
  );
}
