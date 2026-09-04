'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Warehouse, Users, Truck,
  BarChart3, Settings, LogOut, Store, Building2, PackageSearch, Bike, Undo2, CreditCard, Tag, RotateCcw, Bell,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useNotifications } from '@/lib/store-hooks';
import { cn } from '@/lib/utils';
import { ROUTE_ROLES } from '@/config/access-control';
import type { Role } from '@/types';

// roles come from the shared ROUTE_ROLES config so the sidebar can never
// drift from the RoleGuard that actually enforces access on each route.
function rolesFor(href: string): Role[] {
  return ROUTE_ROLES.find((r) => r.href === href)?.roles ?? [];
}

const NAV_ITEMS: { label: string; href: string; icon: any; roles: Role[] }[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: rolesFor('/admin') },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, roles: rolesFor('/admin/notifications') },
  { label: 'Products', href: '/admin/products', icon: Package, roles: rolesFor('/admin/products') },
  { label: 'Inventory', href: '/admin/inventory', icon: BarChart3, roles: rolesFor('/admin/inventory') },
  { label: 'Warehouses', href: '/admin/warehouses', icon: Warehouse, roles: rolesFor('/admin/warehouses') },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart, roles: rolesFor('/admin/orders') },
  { label: 'Shipments', href: '/admin/shipments', icon: PackageSearch, roles: rolesFor('/admin/shipments') },
  { label: 'My Deliveries', href: '/admin/deliveries', icon: Bike, roles: rolesFor('/admin/deliveries') },
  { label: 'Sellers', href: '/admin/sellers', icon: Store, roles: rolesFor('/admin/sellers') },
  { label: 'Vendors', href: '/admin/vendors', icon: Building2, roles: rolesFor('/admin/vendors') },
  { label: 'Purchases', href: '/admin/purchases', icon: Truck, roles: rolesFor('/admin/purchases') },
  { label: 'Vendor Returns', href: '/admin/vendor-returns', icon: Undo2, roles: rolesFor('/admin/vendor-returns') },
  { label: 'Customer Returns', href: '/admin/returns', icon: RotateCcw, roles: rolesFor('/admin/returns') },
  { label: 'Credit Notes', href: '/admin/credit-notes', icon: CreditCard, roles: rolesFor('/admin/credit-notes') },
  { label: 'Offers', href: '/admin/offers', icon: Tag, roles: rolesFor('/admin/offers') },
  { label: 'Users', href: '/admin/users', icon: Users, roles: rolesFor('/admin/users') },
  { label: 'Settings', href: '/admin/settings', icon: Settings, roles: rolesFor('/admin/settings') },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const items = NAV_ITEMS.filter((item) => !user?.role || item.roles.includes(user.role));
  const { data: notifData } = useNotifications();
  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[260px] flex-col bg-[#0F1129] text-gray-300">
      <div className="flex items-center gap-2 px-5 py-5 text-lg font-semibold text-white">
        <Package size={22} className="text-primary-400" />
        EcomXC
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-primary-600 text-white' : 'hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
              {href === '/admin/notifications' && unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link
          href="/"
          className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/5 hover:text-white"
        >
          <Store size={18} />
          Visit Store
        </Link>
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-gray-400">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/5 hover:text-white"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
