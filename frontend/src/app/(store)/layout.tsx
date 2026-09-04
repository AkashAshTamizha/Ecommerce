'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Package, Phone } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { StoreHeader } from '@/components/store/StoreHeader';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  // Unlike the admin dashboard, the storefront never blocks on auth — guests
  // can browse freely. We just quietly try to resolve the session so the
  // header/cart/wishlist reflect a logged-in customer if one exists.
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <div className="min-h-screen bg-gray-50">
      <StoreHeader />
      <main>{children}</main>
      <footer className="mt-16 bg-ink-900 py-12 text-white">
        <div className="grid w-full grid-cols-2 gap-8 px-4 sm:grid-cols-4 sm:px-6 lg:px-10">
          <div className="col-span-2 sm:col-span-1">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600"><Package size={18} /></span>
              EcomXC
            </div>
            <p className="mb-4 text-sm text-ink-300">Your gateway to a world of cutting-edge electronics and gadgets.</p>
            <p className="flex items-center gap-2 text-sm text-ink-100">
              <Phone size={14} /> Got a question? Call us 24/7
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Shop</p>
            <ul className="space-y-2 text-sm text-ink-300">
              <li><Link href="/" className="hover:text-white">All Products</Link></li>
              <li><Link href="/offers" className="hover:text-white">Offers</Link></li>
              <li><Link href="/wishlist" className="hover:text-white">Wishlist</Link></li>
              <li><Link href="/cart" className="hover:text-white">Cart</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Account</p>
            <ul className="space-y-2 text-sm text-ink-300">
              <li><Link href="/orders" className="hover:text-white">Your Orders</Link></li>
              <li><Link href="/returns" className="hover:text-white">Your Returns</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign In</Link></li>
              <li><Link href="/register" className="hover:text-white">Create Account</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">Help</p>
            <ul className="space-y-2 text-sm text-ink-300">
              <li><Link href="/returns" className="hover:text-white">Return Policy</Link></li>
              <li><Link href="/orders" className="hover:text-white">Track Order</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 w-full border-t border-white/10 px-4 pt-6 text-center text-sm text-ink-300 sm:px-6 lg:px-10">
          © {new Date().getFullYear()} EcomXC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
