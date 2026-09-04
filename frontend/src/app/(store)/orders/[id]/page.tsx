'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, MapPin, Package, Truck, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ReturnRequestModal } from '@/components/store/ReturnRequestModal';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Order } from '@/types';

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-6">Loading order…</div>}>
      <OrderDetailContent />
    </Suspense>
  );
}

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === '1';
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: async () => (await api.get<ApiResponse<Order>>(`/orders/${params.id}`)).data.data,
  });

  const cancelOrder = useMutation({
    mutationFn: () => api.patch(`/orders/${params.id}/cancel`),
    onSuccess: () => { toast.success('Order cancelled'); qc.invalidateQueries({ queryKey: ['order', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not cancel order'),
  });

  const [showReturnModal, setShowReturnModal] = useState(false);
  const createReturnRequest = useMutation({
    mutationFn: (body: any) => api.post('/return-requests', body),
    onSuccess: () => { toast.success('Request submitted — we\'ll review it shortly'); setShowReturnModal(false); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not submit request'),
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-6">Loading order…</div>;
  if (!order) return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-6">Order not found.</div>;

  const addr = order.shippingAddress || {};
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);

  const deliveredAt = order.shipment?.deliveredAt;
  const daysSinceDelivery = deliveredAt ? (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24) : null;
  const canRequestReturn = order.status === 'DELIVERED' && (daysSinceDelivery === null || daysSinceDelivery <= 7);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {isSuccess && (
        <div className="mb-6 flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm">
          <CheckCircle2 size={48} className="mb-3 text-green-500" />
          <h1 className="mb-1 text-xl font-semibold text-gray-900">Payment Successful</h1>
          <p className="text-sm text-gray-500">Your order has been placed successfully.</p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Order {order.orderNumber}</h1>
          <p className="text-sm text-gray-400">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.shipment && (
        <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Truck size={16} /> Tracking</h2>
          {order.shipment.trackingNumber && (
            <p className="mb-3 text-sm text-gray-600">
              {order.shipment.courierName} · Tracking #{order.shipment.trackingNumber}
            </p>
          )}
          <div className="space-y-3">
            {order.shipment.events?.map((ev) => (
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
      )}

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><MapPin size={16} /> Delivery Address</h2>
        <p className="text-sm text-gray-600">{addr.fullName} · {addr.phone}</p>
        <p className="text-sm text-gray-600">{addr.addressLine}{addr.landmark ? `, ${addr.landmark}` : ''}</p>
        <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.pincode}</p>
      </div>

      <div className="mb-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Package size={16} /> Items</h2>
        <div className="divide-y divide-gray-100">
          {order.items?.map((item) => {
            const image = item.product?.images?.[0]?.url;
            return (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.product?.name}</p>
                  <p className="text-xs text-gray-400">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(item.price)}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal || 0)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(order.tax || 0)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{order.shippingFee ? formatCurrency(order.shippingFee) : 'Free'}</span></div>
          <div className="flex justify-between border-t border-gray-100 pt-1 text-base font-semibold text-gray-900">
            <span>Total</span><span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/orders" className="text-sm font-medium text-primary-600 hover:text-primary-700">← Back to orders</Link>
        <div className="flex gap-2">
          {canRequestReturn && (
            <Button variant="outline" onClick={() => setShowReturnModal(true)}>
              <RotateCcw size={16} /> Return / Replace
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" onClick={() => cancelOrder.mutate()} isLoading={cancelOrder.isPending}>
              <XCircle size={16} /> Cancel Order
            </Button>
          )}
        </div>
      </div>

      {showReturnModal && (
        <ReturnRequestModal
          order={order}
          onClose={() => setShowReturnModal(false)}
          onSubmit={(body) => createReturnRequest.mutate(body)}
          isLoading={createReturnRequest.isPending}
        />
      )}
    </div>
  );
}
