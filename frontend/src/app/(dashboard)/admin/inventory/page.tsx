'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { ApiResponse, Inventory, Warehouse } from '@/types';

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'in' | 'out' | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page],
    queryFn: async () =>
      (await api.get<ApiResponse<Inventory[]>>('/inventory', { params: { page, limit: 10 } })).data,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: async () => (await api.get<ApiResponse<Inventory[]>>('/inventory/low-stock')).data.data,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: async () => (await api.get<ApiResponse<Warehouse[]>>('/warehouses', { params: { limit: 100 } })).data.data,
  });

  const movement = useMutation({
    mutationFn: (payload: { endpoint: string; body: any }) => api.post(`/inventory/${payload.endpoint}`, payload.body),
    onSuccess: () => {
      toast.success('Stock updated');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setModal(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update stock'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventory Overview</h1>
          <p className="text-sm text-gray-500">Track and manage stock across all warehouses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModal('out')}>
            <ArrowUpCircle size={16} /> Stock Out
          </Button>
          <Button onClick={() => setModal('in')}>
            <ArrowDownCircle size={16} /> Stock In
          </Button>
        </div>
      </div>

      {!!lowStock?.length && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-800">
            <AlertTriangle size={18} />
            <h2 className="text-sm font-semibold">{lowStock.length} product(s) low on stock</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 6).map((i) => (
              <span key={i.id} className="rounded-full bg-white px-3 py-1 text-xs text-amber-800 shadow-sm">
                {(i as any).product?.name} — {i.quantityOnHand} left
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Warehouse</th>
                <th className="px-4 py-3 font-medium">On Hand</th>
                <th className="px-4 py-3 font-medium">Reserved</th>
                <th className="px-4 py-3 font-medium">Available</th>
                <th className="px-4 py-3 font-medium">Reorder Point</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {data?.data.map((i: any) => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.product?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{i.warehouse?.name}</td>
                  <td className="px-4 py-3">{i.quantityOnHand}</td>
                  <td className="px-4 py-3">{i.quantityReserved}</td>
                  <td className={`px-4 py-3 font-medium ${i.isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>
                    {i.availableStock}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{i.reorderPoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      {modal && (
        <StockMovementModal
          type={modal}
          warehouses={warehouses || []}
          onClose={() => setModal(null)}
          onSubmit={(body) => movement.mutate({ endpoint: modal === 'in' ? 'stock-in' : 'stock-out', body })}
          isLoading={movement.isPending}
        />
      )}
    </div>
  );
}

function StockMovementModal({
  type, warehouses, onClose, onSubmit, isLoading,
}: {
  type: 'in' | 'out';
  warehouses: Warehouse[];
  onClose: () => void;
  onSubmit: (body: any) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({ productId: '', warehouseId: '', quantity: '', reference: '', reason: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{type === 'in' ? 'Stock In' : 'Stock Out'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Product ID *</label>
            <input
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Paste product UUID"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Warehouse *</label>
            <select
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quantity *</label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reference</label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Purchase Order # / note"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() =>
              onSubmit({ ...form, quantity: parseInt(form.quantity, 10) })
            }
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
