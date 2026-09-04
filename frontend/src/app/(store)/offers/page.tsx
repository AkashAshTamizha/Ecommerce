'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Tag, Copy, Check, Sparkles, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Offer } from '@/types';

function discountLabel(offer: Offer) {
  const value = offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}% OFF` : `${formatCurrency(offer.discountValue)} OFF`;
  const cap = offer.discountType === 'PERCENTAGE' && offer.maxDiscountAmount ? ` up to ${formatCurrency(offer.maxDiscountAmount)}` : '';
  return `${value}${cap}`;
}

function scopeLabel(offer: Offer) {
  if (offer.scope === 'CATEGORY' && offer.category) return `On ${offer.category.name}`;
  if (offer.scope === 'BRAND' && offer.brand) return `On ${offer.brand.name}`;
  if (offer.scope === 'PRODUCT' && offer.product) return `On ${offer.product.name}`;
  return 'On your entire order';
}

export default function OffersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['storefront-offers'],
    queryFn: async () => (await api.get<ApiResponse<Offer[]>>('/offers/active')).data.data,
  });

  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success(`Coupon "${code}" copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  const coupons = data?.filter((o) => o.type === 'COUPON') || [];
  const automatic = data?.filter((o) => o.type === 'AUTOMATIC') || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-10 text-white sm:px-10">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-primary-100">
          <Sparkles size={14} /> Offers & Deals
        </p>
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Save more on every order</h1>
        <p className="text-sm text-primary-100">Apply a coupon at checkout, or shop — automatic deals apply themselves.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && !data?.length && (
        <div className="rounded-xl bg-white py-16 text-center text-gray-400 shadow-sm">
          No active offers right now — check back soon!
        </div>
      )}

      {!isLoading && !!automatic.length && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Percent size={15} /> Automatic Deals
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {automatic.map((offer) => (
              <div key={offer.id} className="rounded-xl border border-dashed border-primary-200 bg-primary-50/50 p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-primary-600 px-2.5 py-1 text-xs font-bold text-white">{discountLabel(offer)}</span>
                  <span className="text-xs text-gray-400">Applied automatically</span>
                </div>
                <p className="font-semibold text-gray-900">{offer.title}</p>
                {offer.description && <p className="mt-1 text-sm text-gray-500">{offer.description}</p>}
                <p className="mt-2 text-xs text-gray-400">{scopeLabel(offer)}</p>
                {Number(offer.minOrderAmount) > 0 && (
                  <p className="text-xs text-gray-400">Min. order {formatCurrency(offer.minOrderAmount)}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && !!coupons.length && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Tag size={15} /> Coupon Codes
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {coupons.map((offer) => (
              <div key={offer.id} className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700">{discountLabel(offer)}</span>
                  </div>
                  <p className="font-semibold text-gray-900">{offer.title}</p>
                  {offer.description && <p className="mt-1 text-sm text-gray-500">{offer.description}</p>}
                  <p className="mt-2 text-xs text-gray-400">{scopeLabel(offer)}</p>
                  {Number(offer.minOrderAmount) > 0 && (
                    <p className="text-xs text-gray-400">Min. order {formatCurrency(offer.minOrderAmount)}</p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-gray-300 px-3 py-2">
                  <span className="font-mono text-sm font-semibold text-gray-900">{offer.code}</span>
                  <button
                    onClick={() => copyCode(offer.code!)}
                    className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    {copied === offer.code ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          Continue shopping →
        </Link>
      </div>
    </div>
  );
}
