'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { useAuthStore } from '@/lib/auth-store';
import { formatCurrency } from '@/lib/utils';
import type { ApiResponse, ReturnRequest } from '@/types';

const TABS = [
  { id: '', label: 'All' },
  { id: 'REQUESTED,APPROVED,PICKUP_SCHEDULED,PICKED_UP,RECEIVED,REPLACEMENT_SHIPPED', label: 'In Progress' },
  { id: 'REFUNDED,REPLACEMENT_DELIVERED', label: 'Completed' },
  { id: 'REJECTED,CANCELLED', label: 'Closed' },
];

export default function MyReturnsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-return-requests', page, tab],
    enabled: !!user,
    queryFn: async () =>
      (await api.get<ApiResponse<ReturnRequest[]>>('/return-requests/mine', { params: { page, limit: 10, status: tab.includes(',') ? undefined : tab || undefined } })).data,
  });

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  if (!user) return null;

  const requests = (data?.data || []).filter((r) => !tab.includes(',') || tab.split(',').includes(r.status));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">My Returns</h1>

      <div className="mb-5 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading return requests…</p>}

      {!isLoading && requests.length === 0 && (
        <div className="rounded-xl bg-white py-16 text-center shadow-sm">
          <RotateCcw size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="mb-4 text-sm text-gray-500">No return or replacement requests here yet.</p>
          <Link href="/orders" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">View My Orders</Link>
        </div>
      )}

      <div className="space-y-3">
        {requests.map((ret) => {
          const firstItem = ret.items?.[0];
          const image = firstItem?.orderItem?.product?.images?.[0]?.url;
          return (
            <Link
              key={ret.id}
              href={`/returns/${ret.id}`}
              className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300"><RotateCcw size={20} /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{ret.requestNumber}</p>
                  <StatusBadge status={ret.status} />
                </div>
                <p className="text-sm text-gray-500">
                  {ret.type === 'RETURN' ? 'Return' : 'Replacement'} · {ret.items?.length ?? 0} item(s) · Order {ret.order?.orderNumber}
                </p>
                <p className="text-xs text-gray-400">Filed on {new Date(ret.createdAt).toLocaleDateString()}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-gray-300" />
            </Link>
          );
        })}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 rounded-xl bg-white shadow-sm">
          <Pagination meta={data.meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
