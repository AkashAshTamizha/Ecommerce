'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useCart, useCartMutations } from '@/lib/store-hooks';
import { useCouponStore } from '@/lib/coupon-store';
import { formatCurrency } from '@/lib/utils';

// Same front-image fallback used on the product detail page: prefer the
// variant's own primary photo, then any of its other photos, then the
// legacy free-text imageUrl, then the product's own default photo.
function itemImage(item: { variant?: { images?: { url: string; isPrimary: boolean }[]; imageUrl?: string } | null; product: { images?: { url: string }[] } }) {
  const variantImages = item.variant?.images;
  const variantImg = variantImages?.find((img) => img.isPrimary)?.url || variantImages?.[0]?.url || item.variant?.imageUrl;
  return variantImg || item.product.images?.[0]?.url;
}

export default function CartPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: cart, isLoading } = useCart();
  const { updateQuantity, removeItem } = useCartMutations();
  const { applied, setApplied, clear } = useCouponStore();
  const [couponInput, setCouponInput] = useState('');

  const applyCoupon = useMutation({
    mutationFn: (code: string) => api.post('/offers/apply', { code }),
    onSuccess: (res) => {
      const data = res.data.data;
      setApplied({ code: data.code, title: data.title, discount: data.discount });
      toast.success(`Coupon "${data.code}" applied`);
      setCouponInput('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Invalid coupon code'),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <ShoppingBag size={40} className="mx-auto mb-4 text-gray-300" />
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Sign in to view your cart</h1>
        <p className="mb-5 text-sm text-gray-500">Your cart is saved to your account so it&apos;s there whenever you come back.</p>
        <Link href="/login" className="inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
          Sign In
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-400 sm:px-6">Loading cart…</div>;
  }

  const items = cart?.items || [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <ShoppingBag size={40} className="mx-auto mb-4 text-gray-300" />
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Your cart is empty</h1>
        <p className="mb-5 text-sm text-gray-500">Browse products and add something you love.</p>
        <Link href="/" className="inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
          Continue Shopping
        </Link>
      </div>
    );
  }

  const shippingFee = cart!.subtotal >= 999 ? 0 : 49;
  const discount = applied?.discount || 0;
  const total = Math.max(cart!.subtotal + shippingFee - discount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Shopping Cart ({cart?.itemCount})</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const image = itemImage(item);
            return (
              <div key={item.id} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
                <Link href={`/products/${item.product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {image ? <img src={image} alt={item.product.name} className="h-full w-full object-cover" /> : null}
                </Link>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <Link href={`/products/${item.product.slug}`} className="text-sm font-medium text-gray-900 hover:text-primary-600">
                      {item.product.name}
                    </Link>
                    {item.variant && (
                      <p className="text-xs text-gray-400">
                        {Object.entries(item.variant.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    )}
                    {item.quantity > item.availableStock && (
                      <p className="mt-1 text-xs text-danger">Only {item.availableStock} left in stock</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-gray-300">
                      <button
                        onClick={() => updateQuantity.mutate({ id: item.id, quantity: Math.max(1, item.quantity - 1) })}
                        className="p-1.5 text-gray-500 hover:bg-gray-50"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })}
                        className="p-1.5 text-gray-500 hover:bg-gray-50"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.lineTotal)}</span>
                  </div>
                </div>
                <button onClick={() => removeItem.mutate(item.id)} className="self-start text-gray-300 hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="h-fit rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Order Summary</h2>

          {applied ? (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5 text-green-700">
                <Tag size={14} /> <span className="font-mono font-semibold">{applied.code}</span> applied
              </span>
              <button onClick={clear} className="text-green-700 hover:text-green-900">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="mb-4 flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none"
              />
              <button
                onClick={() => couponInput.trim() && applyCoupon.mutate(couponInput.trim())}
                disabled={applyCoupon.isPending || !couponInput.trim()}
                className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(cart!.subtotal)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Coupon Discount</span><span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{shippingFee === 0 ? <span className="text-green-600">Free</span> : formatCurrency(shippingFee)}</span>
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
          <button
            onClick={() => router.push('/checkout')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Proceed to Checkout <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
