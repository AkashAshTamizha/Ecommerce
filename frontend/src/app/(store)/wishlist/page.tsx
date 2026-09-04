'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useWishlist } from '@/lib/store-hooks';
import { useCartMutations, useWishlistMutations } from '@/lib/store-hooks';
import { formatCurrency } from '@/lib/utils';

export default function WishlistPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: wishlist, isLoading } = useWishlist();
  const { addToCart } = useCartMutations();
  const { toggle } = useWishlistMutations();

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">My Wishlist</h1>

      {isLoading && <p className="text-sm text-gray-400">Loading wishlist…</p>}

      {!isLoading && wishlist?.length === 0 && (
        <div className="rounded-xl bg-white py-16 text-center shadow-sm">
          <Heart size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="mb-4 text-sm text-gray-500">Your wishlist is empty.</p>
          <Link href="/" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Browse Products</Link>
        </div>
      )}

      <div className="space-y-3">
        {wishlist?.map((item) => {
          const image = item.product.images?.[0]?.url;
          return (
            <div key={item.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
              <Link href={`/products/${item.product.slug}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${item.product.slug}`} className="text-sm font-medium text-gray-900 hover:text-primary-600">
                  {item.product.name}
                </Link>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.product.sellingPrice)}</span>
                  {item.product.mrp > item.product.sellingPrice && (
                    <span className="text-xs text-gray-400 line-through">{formatCurrency(item.product.mrp)}</span>
                  )}
                </div>
                {!item.inStock && <p className="text-xs text-danger">Out of stock</p>}
              </div>
              <button
                onClick={() => addToCart({ productId: item.product.id })}
                disabled={!item.inStock}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                <ShoppingCart size={14} /> Add to Cart
              </button>
              <button
                onClick={() => toggle(item.product as any)}
                className="text-gray-300 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
