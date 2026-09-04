'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, X, PackageCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, PurchaseOrder, Vendor, Warehouse, Product } from '@/types';

export default function PurchasesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search, status],
    queryFn: async () =>
      (
        await api.get<ApiResponse<PurchaseOrder[]>>('/purchases', {
          params: { page, limit: 10, q: search || undefined, status: status || undefined },
        })
      ).data,
  });

  // The list endpoint only sends `_count.items` (to keep the table light), so
  // opening a modal that needs actual line items fetches the full order.
  const { data: receivingPo } = useQuery({
    queryKey: ['purchase-order', receivingId],
    queryFn: async () => (await api.get<ApiResponse<PurchaseOrder>>(`/purchases/${receivingId}`)).data.data,
    enabled: !!receivingId,
  });
  const { data: viewingPo } = useQuery({
    queryKey: ['purchase-order', viewingId],
    queryFn: async () => (await api.get<ApiResponse<PurchaseOrder>>(`/purchases/${viewingId}`)).data.data,
    enabled: !!viewingId,
  });

  const create = useMutation({
    mutationFn: (body: any) => api.post('/purchases', body),
    onSuccess: () => {
      toast.success('Purchase order created');
      qc.invalidateQueries({ queryKey: ['purchases'] });
      setShowCreate(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create purchase order'),
  });

  const markOrdered = useMutation({
    mutationFn: (id: string) => api.patch(`/purchases/${id}/mark-ordered`),
    onSuccess: () => {
      toast.success('Marked as ordered');
      qc.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const receive = useMutation({
    mutationFn: ({ id, items }: { id: string; items: any[] }) => api.post(`/purchases/${id}/receive`, { items }),
    onSuccess: () => {
      toast.success('Stock received');
      qc.invalidateQueries({ queryKey: ['purchases'] });
      setReceivingId(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to receive stock'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/${id}`),
    onSuccess: () => {
      toast.success('Purchase order deleted');
      qc.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500">Order and receive stock from vendors</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Purchase Order
        </Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by PO number..."
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
            <option value="ORDERED">Ordered</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">PO Number</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Warehouse</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading purchase orders…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No purchase orders found.</td></tr>
              )}
              {data?.data.map((po) => (
                <tr key={po.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{po.poNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{po.vendor?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{po.warehouse?.name}</td>
                  <td className="px-4 py-3 text-gray-900">{po._count?.items ?? 0}</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(po.totalAmount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewingId(po.id)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
                        <Eye size={16} />
                      </button>
                      {po.status === 'DRAFT' && (
                        <button
                          onClick={() => markOrdered.mutate(po.id)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                        >
                          Mark Ordered
                        </button>
                      )}
                      {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button
                          title="Receive stock"
                          onClick={() => setReceivingId(po.id)}
                          className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                        >
                          <PackageCheck size={16} />
                        </button>
                      )}
                      {po.status === 'DRAFT' && (
                        <button
                          onClick={() => { if (confirm('Delete this draft purchase order?')) remove.mutate(po.id); }}
                          className="rounded-md p-1.5 text-danger hover:bg-red-50"
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
        <CreatePOModal
          onClose={() => setShowCreate(false)}
          onSubmit={(body) => create.mutate(body)}
          isLoading={create.isPending}
        />
      )}

      {receivingId && (
        receivingPo ? (
          <ReceiveModal
            po={receivingPo}
            onClose={() => setReceivingId(null)}
            onSubmit={(items) => receive.mutate({ id: receivingId, items })}
            isLoading={receive.isPending}
          />
        ) : (
          <ModalLoading onClose={() => setReceivingId(null)} />
        )
      )}

      {viewingId && (
        viewingPo ? (
          <ViewPOModal po={viewingPo} onClose={() => setViewingId(null)} />
        ) : (
          <ModalLoading onClose={() => setViewingId(null)} />
        )
      )}
    </div>
  );
}

function ModalLoading({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <p className="text-sm text-gray-400">Loading purchase order…</p>
        <button onClick={onClose} className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </div>
  );
}

function CreatePOModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [vendorId, setVendorId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantityOrdered: 1, unitCost: 0 }]);

  const { data: vendors } = useQuery({
    queryKey: ['vendors-all'],
    queryFn: async () => (await api.get<ApiResponse<Vendor[]>>('/vendors', { params: { limit: 100, isActive: true } })).data.data,
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

  const total = lines.reduce((sum, l) => sum + Number(l.quantityOrdered || 0) * Number(l.unitCost || 0), 0);

  const submit = () => {
    if (!vendorId || !warehouseId) { toast.error('Vendor and warehouse are required'); return; }
    const items = lines.filter((l) => l.productId && Number(l.quantityOrdered) > 0);
    if (items.length === 0) { toast.error('Add at least one valid line item'); return; }
    onSubmit({ vendorId, warehouseId, expectedDate: expectedDate || undefined, notes: notes || undefined, items });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">New Purchase Order</h3>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Expected Date</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Line Items</label>
            <button
              onClick={() => setLines([...lines, { productId: '', quantityOrdered: 1, unitCost: 0 }])}
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
                  className="col-span-6 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="">Select product</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <input
                  type="number" min={1} value={line.quantityOrdered}
                  onChange={(e) => updateLine(idx, 'quantityOrdered', e.target.value)}
                  placeholder="Qty"
                  className="col-span-2 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
                <input
                  type="number" min={0} value={line.unitCost}
                  onChange={(e) => updateLine(idx, 'unitCost', e.target.value)}
                  placeholder="Unit cost"
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
          <p className="text-sm text-gray-500">Subtotal: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span></p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button isLoading={isLoading} onClick={submit}>Create Purchase Order</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiveModal({
  po, onClose, onSubmit, isLoading,
}: { po: PurchaseOrder; onClose: () => void; onSubmit: (items: any[]) => void; isLoading: boolean }) {
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries((po.items ?? []).map((it) => [it.id, Math.max(it.quantityOrdered - it.quantityReceived, 0)]))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Receive Stock — {po.poNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {(po.items ?? []).map((item) => {
            const remaining = item.quantityOrdered - item.quantityReceived;
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.product?.name}</p>
                  <p className="text-xs text-gray-400">{item.product?.sku} · Ordered {item.quantityOrdered} · Received {item.quantityReceived}</p>
                </div>
                <input
                  type="number" min={0} max={remaining}
                  value={qty[item.id] ?? 0}
                  onChange={(e) => setQty({ ...qty, [item.id]: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() => onSubmit(Object.entries(qty).map(([purchaseOrderItemId, quantity]) => ({ purchaseOrderItemId, quantity })))}
          >
            Confirm Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

function ViewPOModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{po.poNumber}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <p className="text-gray-500">Vendor</p><p className="text-gray-900">{po.vendor?.name}</p>
          <p className="text-gray-500">Warehouse</p><p className="text-gray-900">{po.warehouse?.name}</p>
          <p className="text-gray-500">Status</p><p><StatusBadge status={po.status} /></p>
          <p className="text-gray-500">Total</p><p className="text-gray-900">{formatCurrency(po.totalAmount)}</p>
        </div>
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {(po.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-gray-900">{item.product?.name}</p>
                <p className="text-xs text-gray-400">{item.product?.sku}</p>
              </div>
              <p className="text-gray-500">{item.quantityReceived}/{item.quantityOrdered} received</p>
              <p className="text-gray-900">{formatCurrency(item.unitCost)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
