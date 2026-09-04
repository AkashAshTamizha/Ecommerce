'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Order } from '@/types';

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

// A COD order is automatically marked PAID when it's moved to DELIVERED
// (see the backend), but staff still need a way to correct payment status
// by hand — e.g. cash collected early, a failed/refunded payment, etc.
const PAYMENT_STATUS_OPTIONS = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [viewing, setViewing] = useState<Order | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, status],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Order[]>>('/orders', {
          params: { page, limit: 10, q: search || undefined, status: status || undefined },
        })
      ).data,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Order status updated');
      qc.invalidateQueries({ queryKey: ['orders'] });
      setViewing(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const updatePaymentStatus = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) =>
      api.patch(`/orders/${id}/payment-status`, { paymentStatus }),
    onSuccess: (_res, vars) => {
      toast.success('Payment status updated');
      qc.invalidateQueries({ queryKey: ['orders'] });
      setViewing((v) => (v ? { ...v, paymentStatus: vars.paymentStatus as any } : v));
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500">Track and manage customer orders</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by order number..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            {Object.keys(NEXT_STATUS).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading orders…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No orders found.</td></tr>
              )}
              {data?.data.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{order._count?.items ?? 0}</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(order.totalAmount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.paymentStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get<ApiResponse<Order>>(`/orders/${order.id}`);
                            setViewing(res.data.data);
                          } catch (err: any) {
                            toast.error(err?.response?.data?.message || 'Failed to load order');
                          }
                        }}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{viewing.orderNumber}</h3>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <p className="text-gray-500">Status</p><p><StatusBadge status={viewing.status} /></p>
              <p className="text-gray-500">Payment</p><p><StatusBadge status={viewing.paymentStatus} /></p>
              <p className="text-gray-500">Method</p><p className="text-gray-900">{viewing.paymentMethod || '—'}</p>
              <p className="text-gray-500">Total</p><p className="text-gray-900">{formatCurrency(viewing.totalAmount)}</p>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Payment status</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_STATUS_OPTIONS.filter((s) => s !== viewing.paymentStatus).map((s) => (
                  <button
                    key={s}
                    onClick={() => updatePaymentStatus.mutate({ id: viewing.id, paymentStatus: s })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Mark {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              {viewing.paymentMethod === 'COD' && viewing.paymentStatus === 'PENDING' && (
                <p className="mt-1 text-xs text-gray-400">COD orders are marked Paid automatically once delivered — use this only to correct it manually.</p>
              )}
            </div>

            {NEXT_STATUS[viewing.status]?.length > 0 && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">Move to</label>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS[viewing.status].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus.mutate({ id: viewing.id, status: s })}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {viewing.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{item.product?.name}</p>
                    <p className="text-xs text-gray-400">{item.product?.sku} · Qty {item.quantity}</p>
                  </div>
                  <p className="text-gray-900">{formatCurrency(item.unitPrice ?? item.price)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
