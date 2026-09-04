import type { Role } from '@/types';

export const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER', 'DELIVERY_AGENT', 'CUSTOMER'];

// Single source of truth for which roles may open which /admin route.
// Sidebar.tsx uses this to decide which links to show; RoleGuard uses it
// to actually block direct navigation. Keep this in sync with the
// `authorize(...)` calls in the backend route files — a role listed here
// that isn't allowed server-side just means the page loads but every
// request in it 403s, so mirror the backend when you change either side.
export const ROUTE_ROLES: { href: string; roles: Role[] }[] = [
  { href: '/admin/products', roles: ['SUPER_ADMIN', 'SELLER'] },
  { href: '/admin/inventory', roles: ['SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER'] },
  { href: '/admin/warehouses', roles: ['SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER'] },
  { href: '/admin/orders', roles: ['SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER'] },
  { href: '/admin/shipments', roles: ['SUPER_ADMIN', 'SELLER', 'STOCK_MANAGER'] },
  { href: '/admin/deliveries', roles: ['DELIVERY_AGENT'] },
  { href: '/admin/sellers', roles: ['SUPER_ADMIN', 'ACCOUNTANT'] },
  { href: '/admin/vendors', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER'] },
  { href: '/admin/purchases', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER'] },
  // Matches backend canManageReturns in vendorReturn.routes.js
  { href: '/admin/vendor-returns', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER'] },
  // Matches backend canManage in returnRequest.routes.js (the refund action
  // itself is further narrowed to SUPER_ADMIN/ACCOUNTANT server-side).
  { href: '/admin/returns', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER'] },
  // Matches backend canManageCreditNotes in vendorCreditNote.routes.js — note this is
  // narrower than vendor-returns (no STOCK_MANAGER), same as the API.
  { href: '/admin/credit-notes', roles: ['SUPER_ADMIN', 'ACCOUNTANT'] },
  { href: '/admin/offers', roles: ['SUPER_ADMIN'] },
  { href: '/admin/users', roles: ['SUPER_ADMIN'] },
  { href: '/admin/settings', roles: ['SUPER_ADMIN', 'ACCOUNTANT'] },
  { href: '/admin/notifications', roles: ALL_ROLES },
  { href: '/admin', roles: ALL_ROLES },
];

/**
 * Returns the roles allowed to view `pathname`, using the longest matching
 * href prefix (so `/admin/credit-notes` wins over the catch-all `/admin`).
 * Returns null when no rule matches, which RoleGuard treats as "no
 * restriction defined" rather than silently locking out a new route.
 */
export function getAllowedRoles(pathname: string): Role[] | null {
  const matches = ROUTE_ROLES.filter(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`)
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0].roles;
}
