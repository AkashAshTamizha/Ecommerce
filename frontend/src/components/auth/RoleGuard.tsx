'use client';

import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { getAllowedRoles } from '@/config/access-control';

/**
 * Blocks rendering of any /admin page the current user's role isn't
 * permitted to see, even if they navigate to the URL directly (the
 * Sidebar only hides the link — it doesn't stop direct navigation).
 * Mount once in the dashboard layout so every admin route is covered,
 * including ones added later.
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const allowedRoles = pathname ? getAllowedRoles(pathname) : null;
  const isBlocked = !!user && !!allowedRoles && !allowedRoles.includes(user.role);

  if (isBlocked) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert size={26} className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
        <p className="max-w-sm text-sm text-gray-500">
          Your role ({user!.role.replace(/_/g, ' ').toLowerCase()}) doesn&apos;t have permission to view this
          page. Contact a Super Admin if you think this is a mistake.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
