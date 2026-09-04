'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone, Package, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Shipment } from '@/types';

const NEXT_STATUS: Record<string, string[]> = {
  PACKED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY'],
  FAILED_DELIVERY: ['OUT_FOR_DELIVERY'],
};

export default function MyDeliveriesPage() {
  const [statusFilter, setStatusFilter] = useState('active');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: async () => (await api.get<ApiResponse<Shipment[]>>('/shipments', { params: { limit: 50 } })).data.data,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/shipments/${id}/status`, { status, note }),
    onSuccess: () => {
      toast.success('Delivery status updated');
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  const shipments = (data || []).filter((s) =>
    statusFilter === 'active'
      ? !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(s.status)
      : ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(s.status)
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Deliveries</h1>
          <p className="text-sm text-gray-500">Packages assigned to you for pickup and delivery</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setStatusFilter('active')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Completed
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading deliveries…</p>}
      {!isLoading && shipments.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          No {statusFilter} deliveries right now.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shipments.map((s) => {
          const addr = s.shippingAddress || {};
          const nextOptions = NEXT_STATUS[s.status] || [];
          return (
            <div key={s.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{s.shipmentNumber}</p>
                  <p className="text-xs text-gray-400">Order {s.order?.orderNumber}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              <div className="mb-3 space-y-1.5 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
                  <span>
                    {addr.fullName ? `${addr.fullName}, ` : ''}{addr.addressLine}{addr.landmark ? `, ${addr.landmark}` : ''}, {addr.city}, {addr.state} {addr.pincode}
                  </span>
                </div>
                {addr.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    <span>{addr.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-gray-400" />
                  <span>{s.order?.items?.length ?? 0} item(s) · {formatCurrency(s.order?.totalAmount || 0)}</span>
                </div>
              </div>

              {s.status === 'FAILED_DELIVERY' && s.failureReason && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">Last attempt failed: {s.failureReason}</p>
              )}

              {nextOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  {nextOptions.map((next) => (
                    <button
                      key={next}
                      onClick={() => {
                        let note: string | undefined;
                        if (next === 'FAILED_DELIVERY') {
                          note = window.prompt('Reason delivery could not be completed:') || '';
                          if (!note) return;
                        }
                        updateStatus.mutate({ id: s.id, status: next, note });
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        next === 'DELIVERED'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : next === 'FAILED_DELIVERY'
                          ? 'border border-red-300 text-red-600 hover:bg-red-50'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {next === 'DELIVERED' && <CheckCircle2 size={14} />}
                      {next === 'FAILED_DELIVERY' && <XCircle size={14} />}
                      Mark {next.replace(/_/g, ' ').toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
