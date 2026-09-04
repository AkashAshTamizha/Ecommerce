'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, Product } from '@/types';

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', page, search, status],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/products', {
        params: { page, limit: 10, q: search || undefined, status: status || undefined },
      });
      return res.data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  // A newly-created product defaults to DRAFT / PENDING and is invisible on
  // the storefront until it's approved (which also activates it) — without
  // this action a seller/admin has no way to make a product go live.
  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/products/${id}/approve`);
      toast.success('Product approved and activated');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejecting this product:');
    if (!reason) return;
    try {
      await api.patch(`/products/${id}/reject`, { reason });
      toast.success('Product rejected');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Rejection failed');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage and organize all your products</p>
        </div>
        <Link href="/admin/products/add">
          <Button>
            <Plus size={16} /> Add Product
          </Button>
        </Link>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by product name, SKU, barcode..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading products…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No products found.</td></tr>
              )}
              {data?.data.map((product) => (
                <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="flex items-center gap-3 px-4 py-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
                      {product.images?.[0]?.url && (
                        <Image src={product.images[0].url} alt={product.name} fill className="object-cover" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900">{product.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{product.sku}</td>
                  <td className="px-4 py-3 text-gray-500">{product.category?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(product.sellingPrice)}</td>
                  <td className="px-4 py-3 text-gray-900">{product.totalStock ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={product.status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={product.approvalStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {product.approvalStatus === 'PENDING' && (
                        <>
                          <button
                            title="Approve & activate"
                            onClick={() => handleApprove(product.id)}
                            className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            title="Reject"
                            onClick={() => handleReject(product.id)}
                            className="rounded-md p-1.5 text-danger hover:bg-red-50"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      <Link href={`/admin/products/${product.id}/edit`} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
                        <Pencil size={16} />
                      </Link>
                      <button onClick={() => handleDelete(product.id)} className="rounded-md p-1.5 text-danger hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>
    </div>
  );
}
