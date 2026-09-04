'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, X, Power, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Offer, Category, Brand, Product } from '@/types';

const EMPTY_FORM = {
  title: '',
  description: '',
  type: 'COUPON' as 'COUPON' | 'AUTOMATIC',
  code: '',
  discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  scope: 'ALL' as 'ALL' | 'CATEGORY' | 'BRAND' | 'PRODUCT',
  categoryId: '',
  brandId: '',
  productId: '',
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  usageLimitPerUser: '',
};

function discountLabel(offer: Offer) {
  const value = offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}%` : formatCurrency(offer.discountValue);
  const cap = offer.discountType === 'PERCENTAGE' && offer.maxDiscountAmount ? ` (up to ${formatCurrency(offer.maxDiscountAmount)})` : '';
  return `${value} off${cap}`;
}

function scopeLabel(offer: Offer) {
  if (offer.scope === 'CATEGORY') return offer.category?.name ? `Category: ${offer.category.name}` : 'Category';
  if (offer.scope === 'BRAND') return offer.brand?.name ? `Brand: ${offer.brand.name}` : 'Brand';
  if (offer.scope === 'PRODUCT') return offer.product?.name ? `Product: ${offer.product.name}` : 'Product';
  return 'Entire cart';
}

function isExpired(offer: Offer) {
  return !!offer.endsAt && new Date(offer.endsAt) < new Date();
}

export default function OffersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['offers', page, search, typeFilter],
    queryFn: async () =>
      (await api.get<ApiResponse<Offer[]>>('/offers', {
        params: { page, limit: 10, q: search || undefined, type: typeFilter || undefined },
      })).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['offers'] });

  const create = useMutation({
    mutationFn: (body: any) => api.post('/offers', body),
    onSuccess: () => { toast.success('Offer created'); invalidate(); setShowModal(false); },
    onError: (err: any) => toast.error(err?.response?.data?.message || err?.response?.data?.errors?.[0]?.message || 'Failed to create offer'),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/offers/${id}`, body),
    onSuccess: () => { toast.success('Offer updated'); invalidate(); setShowModal(false); setEditing(null); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update offer'),
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.patch(`/offers/${id}/toggle`),
    onSuccess: (res: any) => { toast.success(res?.data?.message || 'Offer status updated'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update status'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/offers/${id}`),
    onSuccess: (res: any) => { toast.success(res?.data?.message || 'Offer removed'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove offer'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Offers</h1>
          <p className="text-sm text-gray-500">Coupon codes and automatic discounts for your storefront</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Create Offer
        </Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by title or code..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="COUPON">Coupon</option>
            <option value="AUTOMATIC">Automatic</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Offer</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Applies To</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Validity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading offers…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No offers found. Create your first one.</td></tr>
              )}
              {data?.data.map((offer) => {
                const expired = isExpired(offer);
                return (
                  <tr key={offer.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                          <Tag size={15} />
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{offer.title}</p>
                          <p className="text-xs text-gray-400">
                            {offer.type === 'COUPON' ? (
                              <span className="font-mono font-semibold text-primary-600">{offer.code}</span>
                            ) : (
                              'Automatic — no code needed'
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {discountLabel(offer)}
                      {Number(offer.minOrderAmount) > 0 && (
                        <p className="text-xs text-gray-400">Min. order {formatCurrency(offer.minOrderAmount)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{scopeLabel(offer)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {offer.usedCount}{offer.usageLimit ? ` / ${offer.usageLimit}` : ''}
                      {offer.usageLimitPerUser && <p className="text-xs text-gray-400">{offer.usageLimitPerUser} per customer</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {offer.startsAt && <p>From {new Date(offer.startsAt).toLocaleDateString()}</p>}
                      {offer.endsAt && <p className={expired ? 'text-danger' : ''}>Until {new Date(offer.endsAt).toLocaleDateString()}</p>}
                      {!offer.startsAt && !offer.endsAt && '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggle.mutate(offer.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          offer.isActive && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Power size={11} /> {expired ? 'Expired' : offer.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditing(offer); setShowModal(true); }}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Remove this offer?')) remove.mutate(offer.id); }}
                          className="rounded-md p-1.5 text-danger hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      {showModal && (
        <OfferModal
          offer={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSubmit={(body) => (editing ? update.mutate({ id: editing.id, body }) : create.mutate(body))}
          isLoading={create.isPending || update.isPending}
        />
      )}
    </div>
  );
}

function OfferModal({
  offer, onClose, onSubmit, isLoading,
}: { offer: Offer | null; onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState(
    offer
      ? {
          title: offer.title,
          description: offer.description || '',
          type: offer.type,
          code: offer.code || '',
          discountType: offer.discountType,
          discountValue: String(offer.discountValue),
          maxDiscountAmount: offer.maxDiscountAmount != null ? String(offer.maxDiscountAmount) : '',
          minOrderAmount: offer.minOrderAmount ? String(offer.minOrderAmount) : '',
          scope: offer.scope,
          categoryId: offer.categoryId || '',
          brandId: offer.brandId || '',
          productId: offer.productId || '',
          startsAt: offer.startsAt ? offer.startsAt.slice(0, 10) : '',
          endsAt: offer.endsAt ? offer.endsAt.slice(0, 10) : '',
          usageLimit: offer.usageLimit != null ? String(offer.usageLimit) : '',
          usageLimitPerUser: offer.usageLimitPerUser != null ? String(offer.usageLimitPerUser) : '',
        }
      : EMPTY_FORM
  );
  const [productSearch, setProductSearch] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    enabled: form.scope === 'CATEGORY',
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories')).data.data,
  });
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    enabled: form.scope === 'BRAND',
    queryFn: async () => (await api.get<ApiResponse<Brand[]>>('/brands')).data.data,
  });
  const { data: products } = useQuery({
    queryKey: ['products-search', productSearch],
    enabled: form.scope === 'PRODUCT',
    queryFn: async () => (await api.get<ApiResponse<Product[]>>('/products', { params: { q: productSearch || undefined, limit: 20 } })).data.data,
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.discountValue || Number(form.discountValue) <= 0) return toast.error('Enter a positive discount value');
    if (form.discountType === 'PERCENTAGE' && Number(form.discountValue) > 100) return toast.error('Percentage discount cannot exceed 100');
    if (form.type === 'COUPON' && !form.code.trim()) return toast.error('Coupon code is required');
    if (form.scope === 'CATEGORY' && !form.categoryId) return toast.error('Select a category');
    if (form.scope === 'BRAND' && !form.brandId) return toast.error('Select a brand');
    if (form.scope === 'PRODUCT' && !form.productId) return toast.error('Select a product');

    onSubmit({
      ...form,
      code: form.type === 'COUPON' ? form.code.trim().toUpperCase() : undefined,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      usageLimitPerUser: form.usageLimitPerUser ? Number(form.usageLimitPerUser) : null,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{offer ? 'Edit Offer' : 'Create Offer'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Festive Season Sale"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="COUPON">Coupon (customer enters a code)</option>
                <option value="AUTOMATIC">Automatic (applies on its own)</option>
              </select>
            </div>
            {form.type === 'COUPON' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Coupon Code *</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono uppercase"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Discount Value * {form.discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                min={0}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.discountType === 'PERCENTAGE' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Max Discount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                  placeholder="No cap"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Min. Order Amount (₹)</label>
              <input
                type="number"
                min={0}
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Applies To</label>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value as any, categoryId: '', brandId: '', productId: '' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ALL">Entire Cart</option>
              <option value="CATEGORY">A Category</option>
              <option value="BRAND">A Brand</option>
              <option value="PRODUCT">A Product</option>
            </select>
          </div>

          {form.scope === 'CATEGORY' && (
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select category…</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {form.scope === 'BRAND' && (
            <select
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select brand…</option>
              {brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {form.scope === 'PRODUCT' && (
            <div className="space-y-2">
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select product…</option>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Starts</label>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ends</label>
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Total Usage Limit</label>
              <input
                type="number"
                min={1}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Limit Per Customer</label>
              <input
                type="number"
                min={1}
                value={form.usageLimitPerUser}
                onChange={(e) => setForm({ ...form, usageLimitPerUser: e.target.value })}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={isLoading} onClick={handleSubmit}>{offer ? 'Save Changes' : 'Create Offer'}</Button>
        </div>
      </div>
    </div>
  );
}
