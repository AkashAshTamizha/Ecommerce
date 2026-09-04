'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Check, X, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import type { ApiResponse, Seller } from '@/types';

export default function SellersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sellers', page, search, status],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Seller[]>>('/sellers', {
          params: { page, limit: 10, q: search || undefined, status: status || undefined },
        })
      ).data,
  });

  const setSellerStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/sellers/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Seller status updated');
      qc.invalidateQueries({ queryKey: ['sellers'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Sellers</h1>
        <p className="text-sm text-gray-500">Review, approve and manage marketplace sellers</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by store name or email..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Warehouses</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading sellers…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No sellers found.</td></tr>
              )}
              {data?.data.map((seller) => (
                <tr key={seller.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{seller.storeName}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{seller.user?.name}</div>
                    <div className="text-xs text-gray-400">{seller.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{seller._count?.products ?? 0}</td>
                  <td className="px-4 py-3 text-gray-900">{seller._count?.warehouses ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={seller.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {seller.status !== 'APPROVED' && (
                        <button
                          title="Approve"
                          onClick={() => setSellerStatus.mutate({ id: seller.id, status: 'APPROVED' })}
                          className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {seller.status !== 'SUSPENDED' && seller.status === 'APPROVED' && (
                        <button
                          title="Suspend"
                          onClick={() => setSellerStatus.mutate({ id: seller.id, status: 'SUSPENDED' })}
                          className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50"
                        >
                          <Ban size={16} />
                        </button>
                      )}
                      {seller.status !== 'REJECTED' && seller.status === 'PENDING' && (
                        <button
                          title="Reject"
                          onClick={() => setSellerStatus.mutate({ id: seller.id, status: 'REJECTED' })}
                          className="rounded-md p-1.5 text-danger hover:bg-red-50"
                        >
                          <X size={16} />
                        </button>
                      )}
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
