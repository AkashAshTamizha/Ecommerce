'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Heart, Star, Minus, Plus, ShoppingCart, ShieldCheck, Truck, Tag, BadgeCheck, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ProductCard } from '@/components/store/ProductCard';
import { useAuthStore } from '@/lib/auth-store';
import { useCartMutations, useWishlistMutations, useReviewEligibility, useReviewMutations } from '@/lib/store-hooks';
import type { ApiResponse, Product, ProductVariant } from '@/types';

// Stars the shopper can click to pick 1-5, used in the "write a review" form.
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)} className="text-amber-500">
          <Star size={22} fill={i < value ? 'currentColor' : 'none'} className={i >= value ? 'text-gray-300' : ''} />
        </button>
      ))}
    </div>
  );
}

function WriteReview({ productId }: { productId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: eligibility, isLoading } = useReviewEligibility(productId);
  const { submitReview, deleteReview } = useReviewMutations(productId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Anonymous visitors and non-customers (sellers/admins etc.) never get a
  // review form — only signed-in customers do, and only once we know
  // whether they've actually received an order for this exact product.
  if (!user || user.role !== 'CUSTOMER' || isLoading || !eligibility) return null;

  if (eligibility.alreadyReviewed && eligibility.existingReview) {
    const r = eligibility.existingReview;
    return (
      <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <BadgeCheck size={15} className="text-primary-600" /> Your review
          </div>
          <button
            onClick={() => deleteReview.mutate(r.id)}
            disabled={deleteReview.isPending}
            className="flex items-center gap-1 text-xs font-medium text-danger hover:underline"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
        <div className="mb-1 flex items-center gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} className={i >= r.rating ? 'text-gray-200' : ''} />
          ))}
        </div>
        {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
      </div>
    );
  }

  if (!eligibility.canReview) {
    // Not eligible because they haven't bought (and received) this product —
    // no form, no nagging, just quietly nothing here.
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-100 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-900">
        <BadgeCheck size={15} className="text-primary-600" /> Write a review
        <span className="font-normal text-gray-400">(verified purchase)</span>
      </p>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience with this product (optional)"
        rows={3}
        className="mt-3 w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <button
        onClick={() => {
          if (rating < 1) return;
          submitReview.mutate({ rating, comment: comment.trim() || undefined }, { onSuccess: () => { setRating(0); setComment(''); } });
        }}
        disabled={rating < 1 || submitReview.isPending}
        className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Submit review
      </button>
    </div>
  );
}

// A variant's own gallery (front image first, then its other photos);
// falls back to the legacy imageUrl field for variants created before
// uploads existed. Returns [] if the variant has no photos of its own,
// so the product's general gallery is shown instead.
function variantGallery(v: ProductVariant): { id: string; url: string }[] {
  if (v.images?.length) {
    const front = v.images.find((img) => img.isPrimary) || v.images[0];
    const rest = v.images.filter((img) => img.id !== front.id);
    return [front, ...rest].map((img) => ({ id: img.id, url: img.url }));
  }
  if (v.imageUrl) return [{ id: `variant-${v.id}-legacy`, url: v.imageUrl }];
  return [];
}

// Trim + case-insensitive compare, so a stray space or casing difference in
// how an attribute value was entered on the backend (e.g. "White " vs
// "White") can't cause a valid combination to fail to match here.
function valuesEqual(a: unknown, b: string): boolean {
  return typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
}

// A variant matches only if EVERY currently selected attribute matches —
// never just the one most recently clicked. This is what stops picking a
// size from silently jumping to a different color's variant of that size.
function attributesMatchSelection(variantAttrs: Record<string, string> | undefined, selection: Record<string, string>): boolean {
  return Object.entries(selection).every(([k, v]) => valuesEqual(variantAttrs?.[k], v));
}

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  // Tracks the value picked for each attribute (e.g. { Color: 'Black', Size: '6' })
  // so we can match on the *combination* the shopper has chosen so far, not just
  // the single value they just clicked.
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['storefront-product', params.slug],
    queryFn: async () => (await api.get<ApiResponse<Product>>(`/storefront/products/${params.slug}`)).data.data,
  });

  const setVariant = (v: ProductVariant) => {
    setSelectedVariant(v);
    setActiveImage(0); // jump to the variant's own photo if it has one
  };

  // Merge the newly clicked attribute into whatever's already selected, then
  // look for a variant matching that *whole* combination — not just the one
  // attribute that was clicked. Matching on a single attribute breaks as soon
  // as two variants share a value for that attribute (e.g. Size 6 exists for
  // both White and Black): it would always jump to the first variant with
  // that size, ignoring the color already chosen.
  const selectAttribute = (attr: string, val: string) => {
    const nextAttrs = { ...selectedAttrs, [attr]: val };
    setSelectedAttrs(nextAttrs);
    const matchingVariant = product?.variants?.find((v) => attributesMatchSelection(v.attributes, nextAttrs));
    if (matchingVariant) setVariant(matchingVariant);
  };

  const { addToCart, isAdding } = useCartMutations();
  const { toggle, isWishlisted } = useWishlistMutations();

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-400 sm:px-6">Loading product…</div>;
  }
  if (!product) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-400 sm:px-6">Product not found.</div>;
  }

  const images = product.images?.length ? product.images : [];
  // The offer-computed effectivePrice is based on the product's base
  // sellingPrice, so it only applies when no (separately-priced) variant
  // is selected.
  const hasOffer = !selectedVariant && !!product.activeOffer && product.effectivePrice != null && product.effectivePrice < product.sellingPrice;
  const price = selectedVariant?.price ?? (hasOffer ? product.effectivePrice! : product.sellingPrice);
  const discountPct = product.mrp > price ? Math.round(((product.mrp - price) / product.mrp) * 100) : 0;
  // Once a variant is selected, its own stock (and image, if it has one)
  // take over from the product-wide figures — different variants can have
  // very different stock levels and photos (e.g. a sold-out colour).
  const stock = selectedVariant ? (selectedVariant.stock ?? 0) : (product.totalStock ?? 0);

  // Group variant attribute keys (e.g. Color, Storage) so we can render a
  // selector per attribute type rather than one flat list of SKUs.
  const attributeGroups: Record<string, Set<string>> = {};
  (product.variants || []).forEach((v) => {
    Object.entries(v.attributes || {}).forEach(([k, val]) => {
      attributeGroups[k] = attributeGroups[k] || new Set();
      attributeGroups[k].add(val);
    });
  });

  // If the selected variant has its own photos, lead the gallery with them
  // (e.g. a red vs. blue colourway) while still letting the shopper browse
  // the rest of the product's photos.
  const galleryImages = selectedVariant ? [...variantGallery(selectedVariant), ...images] : images;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="mb-3 aspect-square overflow-hidden rounded-2xl bg-gray-50">
            {galleryImages.length ? (
              <img src={galleryImages[activeImage]?.url ?? galleryImages[0].url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300"><ShoppingCart size={48} /></div>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="flex gap-2">
              {galleryImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${activeImage === i ? 'border-primary-600' : 'border-transparent'}`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.brand?.name && <p className="mb-1 text-sm font-medium text-primary-600">{product.brand.name}</p>}
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">{product.name}</h1>

          {product.avgRating ? (
            <div className="mb-3 flex items-center gap-1.5 text-sm">
              <div className="flex items-center gap-1 text-amber-500">
                <Star size={14} fill="currentColor" /> {product.avgRating}
              </div>
              <span className="text-gray-400">({product.reviewCount} reviews)</span>
            </div>
          ) : null}

          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{formatCurrency(price)}</span>
            {product.mrp > price && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatCurrency(product.mrp)}</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{discountPct}% OFF</span>
              </>
            )}
          </div>
          {hasOffer && (
            <p className="mb-4 -mt-3 flex items-center gap-1.5 text-sm font-medium text-primary-600">
              <Tag size={13} /> {product.activeOffer!.title} applied
            </p>
          )}

          {product.shortDesc && <p className="mb-4 text-sm text-gray-600">{product.shortDesc}</p>}

          {Object.entries(attributeGroups).map(([attr, values]) => (
            <div key={attr} className="mb-4">
              <p className="mb-1.5 text-sm font-medium text-gray-700">{attr}</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(values).map((val) => {
                  const active = selectedAttrs[attr] === val;
                  // Would this value be selectable given what's already chosen
                  // for the other attributes? (e.g. if Color: Black is picked,
                  // Size: 7 is disabled if no Black/7 variant exists.)
                  const hypotheticalAttrs = { ...selectedAttrs, [attr]: val };
                  const isAvailable = product.variants?.some((v) => attributesMatchSelection(v.attributes, hypotheticalAttrs));
                  return (
                    <button
                      key={val}
                      disabled={!isAvailable}
                      onClick={() => selectAttribute(attr, val)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        active
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : isAvailable
                          ? 'border-gray-300 text-gray-700 hover:border-gray-400'
                          : 'cursor-not-allowed border-gray-200 text-gray-300 line-through'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mb-5 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Quantity</span>
            <div className="flex items-center rounded-lg border border-gray-300">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 text-gray-500 hover:bg-gray-50"><Minus size={14} /></button>
              <span className="w-10 text-center text-sm font-medium">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(stock || 99, q + 1))} className="p-2 text-gray-500 hover:bg-gray-50"><Plus size={14} /></button>
            </div>
            <span className={`text-xs ${stock > 0 ? 'text-green-600' : 'text-danger'}`}>
              {stock > 0 ? `${stock} in stock` : 'Out of stock'}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => addToCart({ productId: product.id, variantId: selectedVariant?.id, quantity: qty })}
              disabled={stock === 0 || isAdding}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <ShoppingCart size={16} /> Add to Cart
            </button>
            <button
              onClick={() => toggle(product)}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                isWishlisted(product.id) ? 'border-danger bg-red-50 text-danger' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Heart size={18} fill={isWishlisted(product.id) ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-6 space-y-2 border-t border-gray-100 pt-5 text-sm text-gray-600">
            <div className="flex items-center gap-2"><Truck size={16} className="text-gray-400" /> Free shipping on orders over ₹999</div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-gray-400" /> Sold by {product.seller?.storeName || 'EcomXC'}</div>
          </div>
        </div>
      </div>

      {product.fullDesc && (
        <div className="mt-10 border-t border-gray-100 pt-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Description</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{product.fullDesc}</p>
        </div>
      )}

      <div className="mt-10 border-t border-gray-100 pt-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Reviews</h2>
        <WriteReview productId={product.id} />
        {!!product.reviews?.length && (
          <div className="space-y-4">
            {product.reviews.map((r) => (
              <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} className={i >= r.rating ? 'text-gray-200' : ''} />
                    ))}
                  </div>
                  {r.customer?.name && <span className="text-xs font-medium text-gray-500">{r.customer.name}</span>}
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                <p className="mt-1 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {!!product.related?.length && (
        <div className="mt-10 border-t border-gray-100 pt-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.related.map((p) => (
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
      )}
    </div>
  );
}
