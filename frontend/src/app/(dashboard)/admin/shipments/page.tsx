'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, X, Plus, Truck, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Shipment, Order, Warehouse, DeliveryAgent, ShipmentStatus } from '@/types';

const STATUS_OPTIONS: ShipmentStatus[] = [
  'CREATED', 'PACKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED', 'CANCELLED',
];

const NEXT_STATUS: Record<string, string[]> = {
  CREATED: ['PACKED', 'CANCELLED'],
  PACKED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY'],
  FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
};

export default function ShipmentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['shipments', page, search, status],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Shipment[]>>('/shipments', {
          params: { page, limit: 10, q: search || undefined, status: status || undefined },
        })
      ).data,
  });

  const { data: viewing } = useQuery({
    queryKey: ['shipment', viewingId],
    enabled: !!viewingId,
    queryFn: async () => (await api.get<ApiResponse<Shipment>>(`/shipments/${viewingId}`)).data.data,
  });

  const { data: agents } = useQuery({
    queryKey: ['delivery-agents'],
    queryFn: async () => (await api.get<ApiResponse<DeliveryAgent[]>>('/shipments/agents/available')).data.data,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/shipments/${id}/status`, { status, note }),
    onSuccess: () => {
      toast.success('Shipment status updated');
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['shipment', viewingId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const assignAgent = useMutation({
    mutationFn: ({ id, deliveryAgentId }: { id: string; deliveryAgentId: string }) =>
      api.patch(`/shipments/${id}/assign`, { deliveryAgentId }),
    onSuccess: () => {
      toast.success('Delivery agent assigned');
      qc.invalidateQueries({ queryKey: ['shipments'] });
      qc.invalidateQueries({ queryKey: ['shipment', viewingId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Assignment failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500">Manage packages, couriers and delivery tracking</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create Shipment
        </Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by shipment #, order # or tracking #..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
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
                <th className="px-4 py-3 font-medium">Shipment #</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Courier</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading shipments…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No shipments found.</td></tr>
              )}
              {data?.data.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.shipmentNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{s.order?.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.courierName || '—'}
                    {s.trackingNumber && <span className="block text-xs text-gray-400">{s.trackingNumber}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.deliveryAgent?.name || <span className="text-gray-300">Unassigned</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setViewingId(s.id)}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                        title="View"
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

      {viewingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{viewing?.shipmentNumber || 'Loading…'}</h3>
              <button onClick={() => setViewingId(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {viewing && (
              <>
                <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-500">Order</p><p className="text-gray-900">{viewing.order?.orderNumber}</p>
                  <p className="text-gray-500">Status</p><p><StatusBadge status={viewing.status} /></p>
                  <p className="text-gray-500">Warehouse</p><p className="text-gray-900">{viewing.warehouse?.name}</p>
                  <p className="text-gray-500">Courier</p><p className="text-gray-900">{viewing.courierName || '—'}</p>
                  <p className="text-gray-500">Tracking #</p><p className="text-gray-900">{viewing.trackingNumber || '—'}</p>
                  <p className="text-gray-500">ETA</p>
                  <p className="text-gray-900">{viewing.estimatedDeliveryDate ? new Date(viewing.estimatedDeliveryDate).toLocaleDateString() : '—'}</p>
                  {viewing.order?.totalAmount !== undefined && (
                    <><p className="text-gray-500">Order Total</p><p className="text-gray-900">{formatCurrency(viewing.order.totalAmount)}</p></>
                  )}
                </div>

                <div className="mb-4">
                  <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700"><UserIcon size={14} /> Delivery Agent</label>
                  <select
                    value={viewing.deliveryAgentId || ''}
                    onChange={(e) => e.target.value && assignAgent.mutate({ id: viewing.id, deliveryAgentId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {agents?.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a._count?.shipmentsAssigned ?? 0} active)</option>
                    ))}
                  </select>
                </div>

                {NEXT_STATUS[viewing.status]?.length > 0 && (
                  <div className="mb-4">
                    <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700"><Truck size={14} /> Move to</label>
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STATUS[viewing.status].map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            const note = s === 'FAILED_DELIVERY' ? window.prompt('Reason for failed delivery attempt:') || '' : undefined;
                            if (s === 'FAILED_DELIVERY' && !note) return;
                            updateStatus.mutate({ id: viewing.id, status: s, note });
                          }}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {s.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">Tracking Timeline</p>
                  <div className="space-y-3">
                    {viewing.events?.map((ev) => (
                      <div key={ev.id} className="flex gap-3 text-sm">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                        <div>
                          <p className="font-medium text-gray-900">{ev.status.replace(/_/g, ' ')}</p>
                          {ev.note && <p className="text-xs text-gray-500">{ev.note}</p>}
                          <p className="text-xs text-gray-400">{new Date(ev.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['shipments'] });
          }}
        />
      )}
    </div>
  );
}

function CreateShipmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    orderId: '', warehouseId: '', courierName: '', trackingNumber: '',
    packageWeightKg: '', estimatedDeliveryDate: '',
  });

  const { data: orders } = useQuery({
    queryKey: ['confirmable-orders'],
    queryFn: async () =>
      (await api.get<ApiResponse<Order[]>>('/orders', { params: { status: 'CONFIRMED', limit: 50 } })).data.data,
  });

  const { data: pendingOrders } = useQuery({
    queryKey: ['pending-orders'],
    queryFn: async () =>
      (await api.get<ApiResponse<Order[]>>('/orders', { params: { status: 'PENDING', limit: 50 } })).data.data,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => (await api.get<ApiResponse<Warehouse[]>>('/warehouses', { params: { limit: 100 } })).data.data,
  });

  const eligibleOrders = [...(pendingOrders || []), ...(orders || [])].filter((o: any) => !o.shipment);

  const create = useMutation({
    mutationFn: (body: any) => api.post('/shipments', body),
    onSuccess: () => { toast.success('Shipment created'); onCreated(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create shipment'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Create Shipment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Order *</label>
            <select
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select order…</option>
              {eligibleOrders.map((o: any) => (
                <option key={o.id} value={o.id}>{o.orderNumber} — {formatCurrency(o.totalAmount)}</option>
              ))}
            </select>
            {eligibleOrders.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">No pending or confirmed orders without a shipment yet.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Warehouse *</label>
            <select
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select warehouse…</option>
              {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Courier Name</label>
            <input value={form.courierName} onChange={(e) => setForm({ ...form, courierName: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. BlueDart Express" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tracking #</label>
              <input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Weight (kg)</label>
              <input type="number" step="0.01" value={form.packageWeightKg} onChange={(e) => setForm({ ...form, packageWeightKg: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Estimated Delivery Date</label>
            <input type="date" value={form.estimatedDeliveryDate} onChange={(e) => setForm({ ...form, estimatedDeliveryDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={create.isPending}
            onClick={() => {
              if (!form.orderId || !form.warehouseId) { toast.error('Order and warehouse are required'); return; }
              create.mutate({
                ...form,
                packageWeightKg: form.packageWeightKg ? parseFloat(form.packageWeightKg) : undefined,
              });
            }}
          >
            Create Shipment
          </Button>
        </div>
      </div>
    </div>
  );
}
