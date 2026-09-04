'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, CreditCard, Wallet, Landmark, Banknote, X, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/auth-store';
import { useCart } from '@/lib/store-hooks';
import { useCouponStore } from '@/lib/coupon-store';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Address, Order } from '@/types';

const PAYMENT_METHODS = [
  { id: 'UPI', label: 'UPI / QR', icon: Wallet },
  { id: 'CARD', label: 'Credit / Debit Card', icon: CreditCard },
  { id: 'NETBANKING', label: 'Net Banking', icon: Landmark },
  { id: 'COD', label: 'Cash on Delivery', icon: Banknote },
];

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: cart } = useCart();
  const qc = useQueryClient();
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [showAddForm, setShowAddForm] = useState(false);
  const { applied, clear } = useCouponStore();

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    enabled: !!user,
    queryFn: async () => (await api.get<ApiResponse<Address[]>>('/addresses')).data.data,
  });

  const activeAddressId = selectedAddressId || addresses?.find((a) => a.isDefault)?.id || addresses?.[0]?.id || '';

  const placeOrder = useMutation({
    mutationFn: () => api.post<ApiResponse<Order>>('/orders', { addressId: activeAddressId, paymentMethod, couponCode: applied?.code }),
    onSuccess: (res) => {
      toast.success('Order placed successfully!');
      clear();
      qc.invalidateQueries({ queryKey: ['cart'] });
      router.push(`/orders/${res.data.data.id}?success=1`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not place order'),
  });

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <p className="text-gray-500">Your cart is empty.</p>
      </div>
    );
  }

  const shippingFee = cart.subtotal >= 999 ? 0 : 49;
  const discount = applied?.discount || 0;
  const total = Math.max(cart.subtotal + shippingFee - discount, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Checkout</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Address */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MapPin size={16} /> Delivery Address</h2>
              <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                <Plus size={14} /> Add New
              </button>
            </div>
            <div className="space-y-2">
              {addresses?.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                    activeAddressId === addr.id ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    checked={activeAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{addr.label} · {addr.fullName}</p>
                    <p className="text-gray-500">{addr.addressLine}{addr.landmark ? `, ${addr.landmark}` : ''}</p>
                    <p className="text-gray-500">{addr.city}, {addr.state} {addr.pincode}</p>
                    <p className="text-gray-500">{addr.phone}</p>
                  </div>
                </label>
              ))}
              {!addresses?.length && <p className="text-sm text-gray-400">No saved addresses yet — add one to continue.</p>}
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Payment Method</h2>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                    paymentMethod === m.id ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input type="radio" checked={paymentMethod === m.id} onChange={() => setPaymentMethod(m.id)} className="sr-only" />
                  <m.icon size={16} /> {m.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="h-fit rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Order Summary</h2>
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto border-b border-gray-100 pb-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm text-gray-600">
                <span className="line-clamp-1 pr-2">{item.product.name} × {item.quantity}</span>
                <span className="shrink-0">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
            {applied && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1"><Tag size={12} /> {applied.code}</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{shippingFee === 0 ? <span className="text-green-600">Free</span> : formatCurrency(shippingFee)}</span>
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
            <span>Total Payable</span><span>{formatCurrency(total)}</span>
          </div>
          <Button
            onClick={() => placeOrder.mutate()}
            isLoading={placeOrder.isPending}
            disabled={!activeAddressId}
            className="mt-4 w-full justify-center py-3"
          >
            Place Order
          </Button>
        </div>
      </div>

      {showAddForm && (
        <AddAddressModal
          onClose={() => setShowAddForm(false)}
          onCreated={(addr) => { setSelectedAddressId(addr.id); setShowAddForm(false); qc.invalidateQueries({ queryKey: ['addresses'] }); }}
        />
      )}
    </div>
  );
}

function AddAddressModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Address) => void }) {
  const [form, setForm] = useState({
    label: 'Home', fullName: '', phone: '', addressLine: '', landmark: '',
    city: '', state: '', country: 'India', pincode: '', isDefault: false,
  });

  const create = useMutation({
    mutationFn: () => api.post<ApiResponse<Address>>('/addresses', form),
    onSuccess: (res) => { toast.success('Address saved'); onCreated(res.data.data); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not save address'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Address</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {['Home', 'Work', 'Other'].map((l) => (
              <button
                key={l}
                onClick={() => setForm({ ...form, label: l })}
                className={`rounded-lg border py-1.5 text-sm font-medium ${form.label === l ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-300 text-gray-600'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <input placeholder="Full Name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Address Line *" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="City *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="State *" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Pincode *" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Set as default address
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={create.isPending}
            onClick={() => {
              if (!form.fullName || !form.phone || !form.addressLine || !form.city || !form.state || !form.pincode) {
                toast.error('Please fill all required fields');
                return;
              }
              create.mutate();
            }}
          >
            Save Address
          </Button>
        </div>
      </div>
    </div>
  );
}
