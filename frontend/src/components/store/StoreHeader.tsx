'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Heart, ShoppingCart, User, Package, LogOut, ChevronDown, Tag, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useCart, useWishlist } from '@/lib/store-hooks';
import { NotificationBell } from './NotificationBell';

export function StoreHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: cart } = useCart();
  const { data: wishlist } = useWishlist();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const cartCount = cart?.itemCount ?? 0;
  const wishlistCount = wishlist?.length ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
    
      <div className="flex w-full items-center gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold text-ink-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white"><Package size={18} /></span>
          EcomXC
        </Link>

        <form
          onSubmit={(e) => { e.preventDefault(); router.push(q ? `/?q=${encodeURIComponent(q)}` : '/'); }}
          className="relative hidden flex-1 max-w-xl sm:block"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for products, brands..."
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link href="/offers" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 sm:flex">
            <Tag size={16} /> Offers
          </Link>

          <Link href="/wishlist" className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <Heart size={20} />
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link href="/cart" className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {user && <NotificationBell />}

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                  {user.name?.[0]?.toUpperCase()}
                </span>
                <span className="hidden sm:inline">{user.name?.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg">
                    {user.role === 'CUSTOMER' ? (
                      <>
                        <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Package size={15} /> My Orders
                        </Link>
                        <Link href="/returns" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <RotateCcw size={15} /> My Returns
                        </Link>
                      </>
                    ) : (
                      <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <User size={15} /> Dashboard
                      </Link>
                    )}
                    <button
                      onClick={() => { logout(); setMenuOpen(false); router.push('/'); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700">
              Sign In
            </Link>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); router.push(q ? `/?q=${encodeURIComponent(q)}` : '/'); }}
        className="relative block px-4 pb-3 sm:hidden"
      >
        <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for products..."
          className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:outline-none"
        />
      </form>
    </header>
  );
}
