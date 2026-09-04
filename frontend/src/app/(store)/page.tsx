'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  SlidersHorizontal, ArrowRight, Smartphone, Watch, Camera, Headphones,
  Speaker as SpeakerIcon, Laptop, Gamepad2, Package, Tablet, Tag,
} from 'lucide-react';
import api from '@/lib/api';
import { ProductCard } from '@/components/store/ProductCard';
import { Pagination } from '@/components/ui/Pagination';
import { useCartMutations, useWishlistMutations } from '@/lib/store-hooks';
import type { ApiResponse, Product, Category } from '@/types';

export default function StoreHomePage() {
  return (
    <Suspense fallback={<div className="w-full px-4 py-10 text-sm text-gray-400 sm:px-6 lg:px-10">Loading…</div>}>
      <StoreHomeContent />
    </Suspense>
  );
}

// Categories don't carry an icon or image from the API, so we pick a
// representative lucide icon from the category name. Falls back to a
// generic package icon for anything unrecognized.
function iconForCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes('phone')) return Smartphone;
  if (n.includes('watch')) return Watch;
  if (n.includes('camera')) return Camera;
  if (n.includes('audio') || n.includes('headphone') || n.includes('earbud') || n.includes('bud')) return Headphones;
  if (n.includes('speaker')) return SpeakerIcon;
  if (n.includes('laptop') || n.includes('computer')) return Laptop;
  if (n.includes('tablet')) return Tablet;
  if (n.includes('gam') || n.includes('console')) return Gamepad2;
  return Package;
}

function StoreHomeContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');

  const { data: categories } = useQuery({
    queryKey: ['storefront-categories'],
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories')).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['storefront-products', page, q, category, sortBy],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Product[]>>('/storefront/products', {
          params: { page, limit: 12, q: q || undefined, category: category || undefined, sortBy, sortDir: sortBy === 'sellingPrice' ? 'asc' : 'desc' },
        })
      ).data,
  });

  // A lightweight second slice of the same catalog, sorted by price, to
  // populate a "Best Deals" rail — same real data, a different cut of it.
  const { data: dealsData } = useQuery({
    queryKey: ['storefront-deals'],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Product[]>>('/storefront/products', {
          params: { page: 1, limit: 4, sortBy: 'sellingPrice', sortDir: 'asc' },
        })
      ).data,
    enabled: !q,
  });

  const { addToCart } = useCartMutations();
  const { toggle, isWishlisted } = useWishlistMutations();

  const showLanding = !q;

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10">
      {showLanding && (
        <>
          {/* Hero */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-primary-800 px-6 py-10 text-white sm:px-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
              <p className="mb-2 text-sm font-medium uppercase tracking-wide text-primary-200">Big Summer Sale</p>
              <h1 className="mb-2 max-w-md text-2xl font-bold sm:text-3xl">Up to 50% off electronics &amp; accessories</h1>
              <p className="mb-5 text-sm text-primary-100">Free shipping on orders over ₹999</p>
              <a
                href="#trending"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-primary-50"
              >
                Shop Now <ArrowRight size={15} />
              </a>
            </div>

            <a
              href="#trending"
              onClick={() => setSortBy('sellingPrice')}
              className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-700 to-ink-900 px-6 py-10 text-white"
            >
              <p className="mb-1 text-lg font-bold">Deal of the Week</p>
              <p className="mb-4 text-sm text-white/80">Our lowest prices, ranked for you</p>
              <span className="inline-flex w-fit items-center gap-1.5 text-sm font-medium underline decoration-white/40 underline-offset-4">
                Shop Now <ArrowRight size={14} />
              </span>
            </a>
          </div>

          {/* Collection strip */}
          {!!categories?.length && (
            <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {categories.slice(0, 6).map((c) => {
                const Icon = iconForCategory(c.name);
                const active = category === c.slug;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setCategory(c.slug); setPage(1); document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth' }); }}
                    className="flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-white"
                  >
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full border ${active ? 'border-ink-900 bg-ink-900 text-white' : 'border-gray-200 bg-white text-ink-700'}`}>
                      <Icon size={22} />
                    </span>
                    <span className="line-clamp-1 text-xs font-medium text-gray-700">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Best deals */}
          {!!dealsData?.data.length && (
            <div className="mb-10">
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Best Deals</h2>
                <button
                  onClick={() => { setSortBy('sellingPrice'); document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="flex items-center gap-1 text-sm font-medium text-ink-700 hover:text-ink-900"
                >
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[280px_1fr]">
                <div className="relative hidden overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-ink-900 p-6 text-white sm:flex sm:flex-col sm:justify-between">
                  <div>
                    <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                      <Tag size={11} /> Hot Deals
                    </span>
                    <p className="text-xl font-bold leading-snug">Our lowest priced picks, updated live</p>
                  </div>
                  <a href="#trending" onClick={() => setSortBy('sellingPrice')} className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-900">
                    Shop Now <ArrowRight size={13} />
                  </a>
                </div>
                {/* auto-fill with a capped max width keeps every card a
                    consistent, comfortable size — a short result (e.g. 1-2
                    deals) just leaves quiet space instead of one giant card. */}
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 200px))' }}
                >
                  {dealsData.data.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      isWishlisted={isWishlisted(p.id)}
                      onToggleWishlist={toggle}
                      onAddToCart={(prod) => addToCart({ productId: prod.id })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div id="trending" className="scroll-mt-20">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{q ? `Results for "${q}"` : 'Trending Products'}</h2>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setCategory(''); setPage(1); }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${!category ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            All
          </button>
          {categories?.map((c) => (
            <button
              key={c.id}
              onClick={() => { setCategory(c.slug); setPage(1); }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${category === c.slug ? 'bg-ink-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">{data?.meta ? `${data.meta.total} items` : ''}</p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SlidersHorizontal size={14} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none"
            >
              <option value="createdAt">Newest</option>
              <option value="sellingPrice">Price: Low to High</option>
              <option value="name">Name: A–Z</option>
            </select>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 200px))' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] w-full max-w-[200px] animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        )}

        {!isLoading && data?.data.length === 0 && (
          <div className="rounded-xl bg-white py-16 text-center text-gray-400 shadow-sm">No products found.</div>
        )}

        {!isLoading && !!data?.data.length && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 200px))' }}>
            {data.data.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isWishlisted={isWishlisted(p.id)}
                onToggleWishlist={toggle}
                onAddToCart={(prod) => addToCart({ productId: prod.id })}
              />
            ))}
          </div>
        )}

        {data?.meta && data.meta.totalPages > 1 && (
          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <Pagination meta={data.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      {showLanding && (
        <div className="mt-14 overflow-hidden rounded-2xl bg-gradient-to-r from-ink-900 to-primary-800 px-6 py-8 text-center text-white sm:px-10">
          <h3 className="mb-1 text-lg font-bold">Sign up for our newsletter &amp; get 20% off</h3>
          <p className="mb-5 text-sm text-primary-100">Be the first to hear about new arrivals and deals.</p>
          <NewsletterForm />
        </div>
      )}
    </div>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) {
    return <p className="text-sm font-medium text-white">Thanks — keep an eye on your inbox!</p>;
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (email) setSubscribed(true); }}
      className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        className="w-full rounded-full border-0 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/60"
      />
      <button type="submit" className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-primary-50">
        Subscribe
      </button>
    </form>
  );
}
