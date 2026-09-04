'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { ApiResponse, Category, Brand } from '@/types';

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

export default function AddProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: { minStockLevel: 5, maxStockLevel: 100 },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<ApiResponse<Category[]>>('/categories')).data.data,
  });
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get<ApiResponse<Brand[]>>('/brands')).data.data,
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const res = await api.post('/products', data);
      toast.success('Product created — submitted for approval');
      router.push(`/admin/products/${res.data.data.id}/edit`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="text-xs text-gray-400">Products / Add Product</p>
        <h1 className="text-xl font-semibold text-gray-900">Add Product</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product Name *" span={2}>
              <input {...register('name', { required: true })} className="input" placeholder="e.g. Wireless Bluetooth Headphones" />
            </Field>
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
            <Field label="Barcode (EAN/UPC)">
              <input {...register('barcode')} className="input" placeholder="8901234567890" />
            </Field>
            <Field label="" />
            <Field label="Short Description *" span={2}>
              <textarea {...register('shortDesc', { required: true })} maxLength={200} rows={2} className="input" />
            </Field>
            <Field label="Full Description" span={2}>
              <textarea {...register('fullDesc')} rows={4} className="input" />
            </Field>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Pricing & Inventory</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Selling Price (MRP) *">
              <input type="number" step="0.01" {...register('mrp', { required: true, valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Selling Price (After Disc.) *">
              <input type="number" step="0.01" {...register('sellingPrice', { required: true, valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Cost Price">
              <input type="number" step="0.01" {...register('costPrice', { valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Minimum Stock Level *">
              <input type="number" {...register('minStockLevel', { required: true, valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Maximum Stock Level">
              <input type="number" {...register('maxStockLevel', { valueAsNumber: true })} className="input" />
            </Field>
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={saving}>Save &amp; Next</Button>
        </div>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 1px #6366f1;
        }
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
