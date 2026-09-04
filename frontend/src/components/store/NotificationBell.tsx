'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useNotifications, useNotificationMutations } from '@/lib/store-hooks';
import type { AppNotification, NotificationType } from '@/types';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_ICON: Record<NotificationType, JSX.Element> = {
  INFO: <Info size={16} className="text-blue-500" />,
  SUCCESS: <CheckCircle2 size={16} className="text-green-500" />,
  WARNING: <AlertTriangle size={16} className="text-amber-500" />,
  ERROR: <XCircle size={16} className="text-danger" />,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useNotifications();
  const { markAsRead, markAllAsRead } = useNotificationMutations();

  const notifications: AppNotification[] = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleClick = (n: AppNotification) => {
    if (!n.isRead) markAsRead.mutate(n.id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-100 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">You&apos;re all caught up.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full gap-2.5 border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-gray-50 ${
                      n.isRead ? '' : 'bg-primary-50/40'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.INFO}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-gray-900">{n.title}</span>
                        {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-gray-100 px-4 py-2.5 text-center text-sm font-medium text-primary-600 hover:bg-gray-50"
            >
              View all
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
