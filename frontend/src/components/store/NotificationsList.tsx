'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { ApiResponse, AppNotification, NotificationType, PaginationMeta } from '@/types';

const TYPE_ICON: Record<NotificationType, JSX.Element> = {
  INFO: <Info size={18} className="text-blue-500" />,
  SUCCESS: <CheckCircle2 size={18} className="text-green-500" />,
  WARNING: <AlertTriangle size={18} className="text-amber-500" />,
  ERROR: <XCircle size={18} className="text-danger" />,
};

const PAGE_SIZE = 20;

// Full notification history — every role gets this same list at either
// /notifications (storefront) or /admin/notifications (dashboard); only the
// surrounding layout differs.
export function NotificationsList() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page', page, filter],
    queryFn: async () =>
      (
        await api.get<ApiResponse<{ notifications: AppNotification[]; unreadCount: number }>>(
          `/notifications?page=${page}&limit=${PAGE_SIZE}`
        )
      ).data,
    placeholderData: (prev) => prev,
  });

  const notifications = (data?.data.notifications ?? []).filter((n) => filter === 'all' || !n.isRead);
  const unreadCount = data?.data.unreadCount ?? 0;
  const meta: PaginationMeta | undefined = data?.meta;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications-page'] }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));

  const markAsRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const markAllAsRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: invalidate,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Bell size={20} /> Notifications
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
          >
            <CheckCheck size={15} /> Mark all as read
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
              filter === f ? 'bg-ink-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-gray-400">
            {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
          </p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.isRead && markAsRead.mutate(n.id)}
              className={`flex w-full gap-3 border-b border-gray-50 px-4 py-4 text-left last:border-0 hover:bg-gray-50 ${
                n.isRead ? '' : 'bg-primary-50/40'
              }`}
            >
              <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.INFO}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900">{n.title}</span>
                  {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />}
                </span>
                <span className="mt-0.5 block text-sm text-gray-500">{n.message}</span>
                <span className="mt-1 block text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
              </span>
            </button>
          ))
        )}
      </div>

      {meta && meta.totalPages > 1 && filter === 'all' && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!meta.hasPrevPage}
            className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">Page {meta.page} of {meta.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={!meta.hasNextPage}
            className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
