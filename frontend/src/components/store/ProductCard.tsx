'use client';

import Link from 'next/link';
import { Heart, Star, ShoppingCart, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';

interface Props {
  product: Product;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

// A product counts as "new" for badge purposes if it was listed in the last
// two weeks — mirrors how the admin "New" flag reads elsewhere in the app.
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function ProductCard({ product, isWishlisted, onToggleWishlist, onAddToCart }: Props) {
  const image = product.images?.[0]?.url;

  const hasOffer = !!product.activeOffer && product.effectivePrice != null && product.effectivePrice < product.sellingPrice;
  const displayPrice = hasOffer ? product.effectivePrice! : product.sellingPrice;

  const discountPct = product.mrp > displayPrice
    ? Math.round(((product.mrp - displayPrice) / product.mrp) * 100)
    : 0;
  const outOfStock = product.inStock === false;
  const isNew = Date.now() - new Date(product.createdAt).getTime() < NEW_WINDOW_MS;

  return (
    <div className="group relative flex w-full min-w-[300px] max-w-[500px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gray-50">
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ShoppingCart size={32} />
          </div>
        )}
        {discountPct > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-danger px-2 py-0.5 text-[11px] font-semibold text-white">
            Sale
          </span>
        )}
        {discountPct === 0 && isNew && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-success px-2 py-0.5 text-[11px] font-semibold text-white">
            New
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-xs font-medium text-white">
            Out of Stock
          </span>
        )}
      </Link>

      {onToggleWishlist && (
        <button
          onClick={() => onToggleWishlist(product)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors ${
            isWishlisted ? 'bg-danger text-white' : 'bg-white text-gray-400 hover:text-danger'
          }`}
        >
          <Heart size={15} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      )}

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {typeof product.totalStock === 'number' && (
          <p className="flex items-center gap-1 text-[11px] text-gray-400">
            <span className={`h-1.5 w-1.5 rounded-full ${outOfStock ? 'bg-gray-300' : 'bg-success'}`} />
            {outOfStock ? 'Out of stock' : `In stock · ${product.totalStock} left`}
          </p>
        )}

        <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-ink-700">
          {product.name}
        </Link>

        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-base font-semibold text-ink-900">{formatCurrency(displayPrice)}</span>
          {product.mrp > displayPrice && (
            <span className="text-xs text-gray-400 line-through">{formatCurrency(product.mrp)}</span>
          )}
        </div>

        <div className="flex items-center gap-0.5 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} fill={product.avgRating && i < Math.round(product.avgRating) ? 'currentColor' : 'none'} className={product.avgRating ? '' : 'text-gray-200'} />
          ))}
          {!!product.reviewCount && <span className="ml-1 text-[11px] text-gray-400">({product.reviewCount})</span>}
        </div>

        {hasOffer && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-ink-700">
            <Tag size={10} /> {product.activeOffer!.title}
          </p>
        )}

        {onAddToCart && (
          <button
            onClick={() => onAddToCart(product)}
            disabled={outOfStock}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-ink-900 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            <ShoppingCart size={14} /> {outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  );
}
