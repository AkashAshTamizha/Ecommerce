'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Pencil, ImagePlus, ArrowDownCircle, ArrowUpCircle, Boxes, Check, PackagePlus, Star } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ApiResponse, Category, Brand, Product, ProductVariant, ProductImage, Warehouse, Inventory } from '@/types';

const ATTRIBUTE_SUGGESTIONS = ['Color', 'Size', 'Series', 'Motor Technology', 'Capacity'];

// A variant's "front" image is its primary uploaded image; falls back to
// the legacy imageUrl text field for variants created before uploads existed.
function frontImageOf(v: ProductVariant): string | undefined {
  return v.images?.find((img) => img.isPrimary)?.url || v.images?.[0]?.url || v.imageUrl;
}

interface FormData {
  name: string;
  categoryId: string;
  brandId?: string;
  barcode?: string;
  shortDesc: string;
  fullDesc?: string;
  mrp: number;
  sellingPrice: number;
  costPrice?: number;
  minStockLevel: number;
  maxStockLevel: number;
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [editVariant, setEditVariant] = useState<ProductVariant | null>(null);
  const [showAddStock, setShowAddStock] = useState(false);
  const [stockActionRow, setStockActionRow] = useState<{ inv: Inventory | null; variant?: ProductVariant; mode: 'in' | 'out' | 'accounting' } | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', params.id],
    queryFn: async () => (await api.get<ApiResponse<Product>>(`/products/${params.id}`)).data.data,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories')).data.data,
  });
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get<ApiResponse<Brand[]>>('/brands')).data.data,
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => (await api.get<ApiResponse<Warehouse[]>>('/warehouses', { params: { limit: 100 } })).data.data,
  });
  const { data: inventoryRows } = useQuery({
    queryKey: ['product-inventory', params.id],
    enabled: !!params.id,
    queryFn: async () => (await api.get<ApiResponse<Inventory[]>>('/inventory', { params: { productId: params.id, limit: 100 } })).data.data,
  });

  const { register, handleSubmit, reset } = useForm<FormData>();

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        categoryId: product.categoryId,
        brandId: product.brandId,
        barcode: product.barcode,
        shortDesc: product.shortDesc,
        fullDesc: product.fullDesc,
        mrp: Number(product.mrp),
        sellingPrice: Number(product.sellingPrice),
        costPrice: product.costPrice ? Number(product.costPrice) : undefined,
        minStockLevel: product.minStockLevel,
        maxStockLevel: product.maxStockLevel,
      });
    }
  }, [product, reset]);

  const saveProduct = useMutation({
    mutationFn: (data: FormData) => api.patch(`/products/${params.id}`, data),
    onSuccess: () => { toast.success('Product updated'); qc.invalidateQueries({ queryKey: ['product', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update product'),
  });

  const uploadImages = useMutation({
    mutationFn: (files: FileList) => {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('images', f));
      return api.post(`/products/${params.id}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { toast.success('Images uploaded'); qc.invalidateQueries({ queryKey: ['product', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to upload images'),
  });

  const deleteImage = useMutation({
    mutationFn: (imageId: string) => api.delete(`/products/${params.id}/images/${imageId}`),
    onSuccess: () => { toast.success('Image removed'); qc.invalidateQueries({ queryKey: ['product', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove image'),
  });

  const deleteVariant = useMutation({
    mutationFn: (variantId: string) => api.delete(`/products/${params.id}/variants/${variantId}`),
    onSuccess: () => {
      toast.success('Variant deleted');
      qc.invalidateQueries({ queryKey: ['product', params.id] });
      qc.invalidateQueries({ queryKey: ['product-inventory', params.id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete variant'),
  });

  const updateVariant = useMutation({
    mutationFn: (payload: { variantId: string; body: any }) => api.patch(`/products/${params.id}/variants/${payload.variantId}`, payload.body),
    onSuccess: () => {
      toast.success('Variant updated');
      qc.invalidateQueries({ queryKey: ['product', params.id] });
      setEditVariant(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update variant'),
  });

  const approveProduct = useMutation({
    mutationFn: () => api.patch(`/products/${params.id}/approve`),
    onSuccess: () => { toast.success('Product approved and activated'); qc.invalidateQueries({ queryKey: ['product', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Approval failed'),
  });

  const rejectProduct = useMutation({
    mutationFn: (reason: string) => api.patch(`/products/${params.id}/reject`, { reason }),
    onSuccess: () => { toast.success('Product rejected'); qc.invalidateQueries({ queryKey: ['product', params.id] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Rejection failed'),
  });

  const stockMovement = useMutation({
    mutationFn: (payload: { endpoint: string; body: any }) => api.post(`/inventory/${payload.endpoint}`, payload.body),
    onSuccess: () => {
      toast.success('Stock updated');
      qc.invalidateQueries({ queryKey: ['product-inventory', params.id] });
      setStockActionRow(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update stock'),
  });

  const accountingStock = useMutation({
    mutationFn: (payload: { id: string; body: any }) => api.patch(`/inventory/${payload.id}/accounting-stock`, payload.body),
    onSuccess: () => {
      toast.success('Accounting stock updated');
      qc.invalidateQueries({ queryKey: ['product-inventory', params.id] });
      setStockActionRow(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update accounting stock'),
  });

  // Group inventory rows: one row per (warehouse, variant|base-product)
  const stockRows = useMemo(() => {
    const rows = inventoryRows || [];
    return rows.map((r) => ({
      ...r,
      variant: (product?.variants || []).find((v) => v.id === r.variantId),
    }));
  }, [inventoryRows, product]);

  if (isLoading) return <div className="py-16 text-center text-gray-400">Loading product…</div>;
  if (!product) return <div className="py-16 text-center text-gray-400">Product not found.</div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Products / Edit</p>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
            <StatusBadge status={product.status} />
            <StatusBadge status={product.approvalStatus} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {product.approvalStatus === 'PENDING' && (
            <>
              <Button
                isLoading={approveProduct.isPending}
                onClick={() => approveProduct.mutate()}
              >
                <Check size={16} /> Approve &amp; Activate
              </Button>
              <Button
                variant="outline"
                isLoading={rejectProduct.isPending}
                onClick={() => {
                  const reason = prompt('Reason for rejecting this product:');
                  if (reason) rejectProduct.mutate(reason);
                }}
              >
                <X size={16} /> Reject
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push('/admin/products')}>Back to List</Button>
        </div>
      </div>

      {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Rejected:</strong> {product.rejectionReason}
        </div>
      )}

      {/* Basic Info + Pricing */}
      <form onSubmit={handleSubmit((d) => saveProduct.mutate(d))} className="mb-6 space-y-6 rounded-xl bg-white p-6 shadow-sm">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product Name *" span={2}><input {...register('name', { required: true })} className="input" /></Field>
            <Field label="Category *">
              <select {...register('categoryId', { required: true })} className="input">
                <option value="">Select category</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <select {...register('brandId')} className="input">
                <option value="">Select brand</option>
                {brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Barcode (EAN/UPC)"><input {...register('barcode')} className="input" /></Field>
            <Field label="SKU"><input value={product.sku} disabled className="input bg-gray-50 text-gray-400" /></Field>
            <Field label="Short Description *" span={2}><textarea {...register('shortDesc', { required: true })} maxLength={200} rows={2} className="input" /></Field>
            <Field label="Full Description" span={2}><textarea {...register('fullDesc')} rows={4} className="input" /></Field>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Pricing &amp; Inventory Defaults</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="MRP *"><input type="number" step="0.01" {...register('mrp', { required: true, valueAsNumber: true })} className="input" /></Field>
            <Field label="Selling Price *"><input type="number" step="0.01" {...register('sellingPrice', { required: true, valueAsNumber: true })} className="input" /></Field>
            <Field label="Cost Price"><input type="number" step="0.01" {...register('costPrice', { valueAsNumber: true })} className="input" /></Field>
            <Field label="Minimum Stock Level *"><input type="number" {...register('minStockLevel', { required: true, valueAsNumber: true })} className="input" /></Field>
            <Field label="Maximum Stock Level"><input type="number" {...register('maxStockLevel', { valueAsNumber: true })} className="input" /></Field>
          </div>
        </section>

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <Button type="submit" isLoading={saveProduct.isPending}>Save Changes</Button>
        </div>
      </form>

      {/* Images */}
      <section className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Images</h2>
        <div className="flex flex-wrap gap-3">
          {product.images?.map((img) => (
            <div key={img.id} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.isPrimary && <span className="absolute left-1 top-1 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Primary</span>}
              <button
                onClick={() => deleteImage.mutate(img.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500">
            <ImagePlus size={20} />
            <span className="text-[10px]">Upload</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && uploadImages.mutate(e.target.files)}
            />
          </label>
        </div>
      </section>

      {/* Variants */}
      <section className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Variants</h2>
          <Button variant="outline" onClick={() => setShowAddVariant(true)}><Plus size={14} /> Add Variant</Button>
        </div>

        {!product.variants?.length && <p className="text-sm text-gray-400">No variants yet — add one for options like Color, Size, Series, Motor Technology or Capacity.</p>}

        {!!product.variants?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                  <th className="px-3 py-2 font-medium">Image</th>
                  <th className="px-3 py-2 font-medium">Attributes</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((v) => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="px-3 py-2">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        {frontImageOf(v) ? (
                          <img src={frontImageOf(v)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300"><ImagePlus size={14} /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(v.attributes || {}).map(([k, val]) => (
                          <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{k}: {val}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{v.sku}</td>
                    <td className="px-3 py-2 text-gray-900">₹{Number(v.price).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditVariant(v)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-primary-600"
                          title="Edit variant"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => deleteVariant.mutate(v.id)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-danger"
                          title="Delete variant"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stock: Physical vs Accounting */}
      <section className="mb-10 rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Boxes size={16} /> Stock</h2>
          <Button variant="outline" onClick={() => setShowAddStock(true)}><PackagePlus size={14} /> Add Stock to Warehouse</Button>
        </div>

        {!stockRows.length && <p className="text-sm text-gray-400">No stock has been recorded for this product yet. Use &quot;Add Stock to Warehouse&quot; to record the first count.</p>}

        {!!stockRows.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                  <th className="px-3 py-2 font-medium" rowSpan={2}>Warehouse / Variant</th>
                  <th className="px-3 py-2 text-center font-medium" colSpan={3}>Physical Stock</th>
                  <th className="px-3 py-2 text-center font-medium" colSpan={3}>Accounting Stock</th>
                  <th className="px-3 py-2 font-medium text-right" rowSpan={2}>Actions</th>
                </tr>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <th className="px-3 py-1 text-center font-medium">On Hand</th>
                  <th className="px-3 py-1 text-center font-medium">Committed</th>
                  <th className="px-3 py-1 text-center font-medium">Available</th>
                  <th className="px-3 py-1 text-center font-medium">On Hand</th>
                  <th className="px-3 py-1 text-center font-medium">Committed</th>
                  <th className="px-3 py-1 text-center font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{r.warehouse?.name || '—'}</p>
                      {r.variant && (
                        <p className="text-xs text-gray-400">
                          {Object.entries(r.variant.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{r.quantityOnHand}</td>
                    <td className="px-3 py-2 text-center">{r.quantityReserved}</td>
                    <td className={`px-3 py-2 text-center font-medium ${r.isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>
                      {r.availableStock ?? r.quantityOnHand - r.quantityReserved}
                    </td>
                    <td className="px-3 py-2 text-center">{r.accountingOnHand}</td>
                    <td className="px-3 py-2 text-center">{r.accountingReserved}</td>
                    <td className="px-3 py-2 text-center font-medium text-gray-900">
                      {r.accountingAvailable ?? r.accountingOnHand - r.accountingReserved}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Stock In"
                          onClick={() => setStockActionRow({ inv: r, variant: r.variant, mode: 'in' })}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"
                        >
                          <ArrowDownCircle size={15} />
                        </button>
                        <button
                          title="Stock Out"
                          onClick={() => setStockActionRow({ inv: r, variant: r.variant, mode: 'out' })}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                        >
                          <ArrowUpCircle size={15} />
                        </button>
                        <button
                          title="Edit Accounting Stock"
                          onClick={() => setStockActionRow({ inv: r, variant: r.variant, mode: 'accounting' })}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-primary-600"
                        >
                          <Pencil size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Physical stock changes go through the movement ledger (Stock In / Stock Out) so every change is auditable.
          Accounting stock is the book figure used for reconciliation and can be corrected directly.
        </p>
      </section>

      {showAddVariant && (
        <AddVariantModal
          productId={product.id}
          warehouses={warehouses || []}
          onClose={() => setShowAddVariant(false)}
          onCreated={() => {
            setShowAddVariant(false);
            qc.invalidateQueries({ queryKey: ['product', params.id] });
            qc.invalidateQueries({ queryKey: ['product-inventory', params.id] });
          }}
        />
      )}

      {editVariant && (
        <EditVariantModal
          productId={product.id}
          variant={editVariant}
          onClose={() => setEditVariant(null)}
          isLoading={updateVariant.isPending}
          onSave={(body) => updateVariant.mutate({ variantId: editVariant.id, body })}
        />
      )}

      {showAddStock && (
        <AddStockModal
          productId={product.id}
          variants={product.variants || []}
          warehouses={warehouses || []}
          isLoading={stockMovement.isPending}
          onClose={() => setShowAddStock(false)}
          onSave={(body) => {
            stockMovement.mutate({ endpoint: 'stock-in', body });
            setShowAddStock(false);
          }}
        />
      )}

      {stockActionRow && (
        <StockActionModal
          row={stockActionRow}
          productId={product.id}
          onClose={() => setStockActionRow(null)}
          onStockMovement={(endpoint, body) => stockMovement.mutate({ endpoint, body })}
          onAccountingSave={(id, body) => accountingStock.mutate({ id, body })}
          isLoading={stockMovement.isPending || accountingStock.isPending}
        />
      )}

      <style jsx global>{`
        .input { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 1px #6366f1; }
      `}</style>
    </div>
  );
}

function Field({ label, span = 1, children }: { label: string; span?: number; children?: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      {children}
    </div>
  );
}

function AddVariantModal({
  productId, warehouses, onClose, onCreated,
}: { productId: string; warehouses: Warehouse[]; onClose: () => void; onCreated: () => void }) {
  const [rows, setRows] = useState<{ key: string; value: string }[]>([{ key: 'Color', value: '' }]);
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const create = useMutation({
    mutationFn: (body: any) => api.post(`/products/${productId}/variants`, body),
    onSuccess: () => { toast.success('Variant added'); onCreated(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add variant'),
  });

  const usedKeys = rows.map((r) => r.key);
  const availableSuggestions = ATTRIBUTE_SUGGESTIONS.filter((s) => !usedKeys.includes(s));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Variant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="mb-4 space-y-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Attributes *</label>
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={row.key}
                onChange={(e) => setRows(rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))}
                className="input w-40"
              >
                <option value={row.key}>{row.key || 'Select…'}</option>
                {availableSuggestions.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__custom__">Custom…</option>
              </select>
              {row.key === '__custom__' ? (
                <input
                  placeholder="Attribute name"
                  onChange={(e) => setRows(rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))}
                  className="input"
                />
              ) : null}
              <input
                placeholder="Value (e.g. Blue, 128GB)"
                value={row.value}
                onChange={(e) => setRows(rows.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))}
                className="input"
              />
              {rows.length > 1 && (
                <button onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="shrink-0 text-gray-300 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {availableSuggestions.length + 1 > 0 && (
            <button
              onClick={() => setRows([...rows, { key: availableSuggestions[0] || '__custom__', value: '' }])}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus size={12} /> Add attribute
            </button>
          )}
          <p className="text-xs text-gray-400">Suggested: {ATTRIBUTE_SUGGESTIONS.join(', ')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU (optional)"><input value={sku} onChange={(e) => setSku(e.target.value)} className="input" placeholder="Auto-generated if blank" /></Field>
          <Field label="Price *"><input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" /></Field>
          <Field label="Compare-at Price"><input type="number" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} className="input" /></Field>
          <div className="col-span-2 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-500">
            You can upload a front image and other photos for this variant right after it&apos;s created — open it with the edit (pencil) icon.
          </div>
          <Field label="Initial Quantity"><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" placeholder="0" /></Field>
          <Field label="Warehouse" span={2}>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
              <option value="">Select warehouse (required if setting quantity)</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={create.isPending}
            onClick={() => {
              const attributes: Record<string, string> = {};
              rows.forEach((r) => { if (r.key && r.key !== '__custom__' && r.value) attributes[r.key] = r.value; });
              if (!Object.keys(attributes).length) { toast.error('Add at least one attribute with a value'); return; }
              if (!price) { toast.error('Price is required'); return; }
              if (quantity && !warehouseId) { toast.error('Select a warehouse to set an initial quantity'); return; }
              create.mutate({
                attributes,
                sku: sku || undefined,
                price: parseFloat(price),
                compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : undefined,
                quantity: quantity ? parseInt(quantity, 10) : undefined,
                warehouseId: warehouseId || undefined,
              });
            }}
          >
            Add Variant
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditVariantModal({
  productId, variant, onClose, onSave, isLoading,
}: { productId: string; variant: ProductVariant; onClose: () => void; onSave: (body: any) => void; isLoading: boolean }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(variant.price));
  const [compareAtPrice, setCompareAtPrice] = useState(variant.compareAtPrice ? String(variant.compareAtPrice) : '');
  const [isActive, setIsActive] = useState(variant.isActive);
  // Kept in local state (not just the query cache) so uploads/deletes show up
  // immediately in this modal without needing the parent list to re-render.
  const [images, setImages] = useState<ProductImage[]>(variant.images || []);

  const invalidateProduct = () => qc.invalidateQueries({ queryKey: ['product', productId] });

  const uploadImages = useMutation({
    mutationFn: (files: FileList) => {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('images', f));
      return api.post<ApiResponse<ProductImage[]>>(
        `/products/${productId}/variants/${variant.id}/images`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    },
    onSuccess: (res) => { setImages((prev) => [...prev, ...res.data.data]); toast.success('Images uploaded'); invalidateProduct(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to upload images'),
  });

  const deleteImage = useMutation({
    mutationFn: (imageId: string) => api.delete(`/products/${productId}/variants/${variant.id}/images/${imageId}`),
    onSuccess: (_res, imageId) => { setImages((prev) => prev.filter((img) => img.id !== imageId)); toast.success('Image removed'); invalidateProduct(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove image'),
  });

  const setPrimary = useMutation({
    mutationFn: (imageId: string) => api.patch(`/products/${productId}/variants/${variant.id}/images/${imageId}/primary`),
    onSuccess: (_res, imageId) => {
      setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
      toast.success('Front image updated');
      invalidateProduct();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to set front image'),
  });

  const frontImage = images.find((img) => img.isPrimary) || images[0];
  const otherImages = images.filter((img) => img.id !== frontImage?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Variant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <p className="mb-4 flex flex-wrap gap-1 text-xs text-gray-500">
          {Object.entries(variant.attributes || {}).map(([k, v]) => (
            <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{k}: {v}</span>
          ))}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Front Image</label>
            <p className="mb-2 text-xs text-gray-400">Shown first when a customer selects this option.</p>
            {frontImage ? (
              <div className="group relative h-28 w-28 overflow-hidden rounded-lg border border-gray-200">
                <img src={frontImage.url} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <Star size={9} className="fill-white" /> Front
                </span>
                <button
                  onClick={() => deleteImage.mutate(frontImage.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500">
                <ImagePlus size={20} />
                <span className="text-[10px]">Upload front image</span>
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.length && uploadImages.mutate(e.target.files)}
                />
              </label>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Other Images</label>
            <div className="flex flex-wrap gap-3">
              {otherImages.map((img) => (
                <div key={img.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      title="Set as front image"
                      onClick={() => setPrimary.mutate(img.id)}
                      className="rounded-full bg-white/90 p-1 text-gray-700 hover:text-primary-600"
                    >
                      <Star size={12} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => deleteImage.mutate(img.id)}
                      className="rounded-full bg-white/90 p-1 text-gray-700 hover:text-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500">
                <ImagePlus size={18} />
                <span className="text-[10px]">Upload</span>
                <input
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => e.target.files?.length && uploadImages.mutate(e.target.files)}
                />
              </label>
            </div>
          </div>

          <Field label="Price"><input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" /></Field>
          <Field label="Compare-at Price"><input type="number" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (visible for purchase on the storefront)
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() => {
              if (!price) { toast.error('Price is required'); return; }
              onSave({
                price: parseFloat(price),
                compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
                isActive,
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddStockModal({
  productId, variants, warehouses, onClose, onSave, isLoading,
}: {
  productId: string;
  variants: ProductVariant[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSave: (body: any) => void;
  isLoading: boolean;
}) {
  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Stock to Warehouse</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Records a Stock In movement. If this product/variant has never been stocked in the chosen warehouse before, a new stock record is created automatically.
        </p>

        <div className="space-y-3">
          {!!variants.length && (
            <Field label="Variant">
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="input">
                <option value="">Base product (no variant)</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', ')} ({v.sku})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Warehouse *">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
              <option value="">Select warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </Field>
          <Field label="Quantity *"><input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" /></Field>
          <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className="input" placeholder="Purchase Order # / note" /></Field>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() => {
              if (!warehouseId) { toast.error('Select a warehouse'); return; }
              if (!quantity || parseInt(quantity, 10) <= 0) { toast.error('Enter a valid quantity'); return; }
              onSave({
                productId,
                variantId: variantId || undefined,
                warehouseId,
                quantity: parseInt(quantity, 10),
                reference,
                reason: 'Initial stock entry',
              });
            }}
          >
            Add Stock
          </Button>
        </div>
      </div>
    </div>
  );
}
function StockActionModal({
  row, productId, onClose, onStockMovement, onAccountingSave, isLoading,
}: {
  row: { inv: Inventory | null; variant?: ProductVariant; mode: 'in' | 'out' | 'accounting' };
  productId: string;
  onClose: () => void;
  onStockMovement: (endpoint: string, body: any) => void;
  onAccountingSave: (id: string, body: any) => void;
  isLoading: boolean;
}) {
  const inv = row.inv!;
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [accountingOnHand, setAccountingOnHand] = useState(String(inv.accountingOnHand));
  const [accountingReserved, setAccountingReserved] = useState(String(inv.accountingReserved));

  const titles = { in: 'Stock In', out: 'Stock Out', accounting: 'Edit Accounting Stock' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{titles[row.mode]}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          {inv.warehouse?.name}{row.variant ? ` · ${Object.entries(row.variant.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}` : ''}
        </p>

        {row.mode !== 'accounting' ? (
          <div className="space-y-3">
            <Field label="Quantity *"><input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" /></Field>
            <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className="input" placeholder="Purchase Order # / note" /></Field>
            {row.mode === 'out' && <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} className="input" /></Field>}
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Accounting On Hand"><input type="number" min={0} value={accountingOnHand} onChange={(e) => setAccountingOnHand(e.target.value)} className="input" /></Field>
            <Field label="Accounting Committed"><input type="number" min={0} value={accountingReserved} onChange={(e) => setAccountingReserved(e.target.value)} className="input" /></Field>
            <p className="text-xs text-gray-400">This corrects the book figure directly for reconciliation — it doesn&apos;t move physical stock.</p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() => {
              if (row.mode === 'accounting') {
                onAccountingSave(inv.id, {
                  accountingOnHand: parseInt(accountingOnHand, 10),
                  accountingReserved: parseInt(accountingReserved, 10),
                });
                return;
              }
              if (!quantity || parseInt(quantity, 10) <= 0) { toast.error('Enter a valid quantity'); return; }
              onStockMovement(row.mode === 'in' ? 'stock-in' : 'stock-out', {
                productId,
                variantId: row.variant?.id,
                warehouseId: inv.warehouseId,
                quantity: parseInt(quantity, 10),
                reference,
                reason,
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
