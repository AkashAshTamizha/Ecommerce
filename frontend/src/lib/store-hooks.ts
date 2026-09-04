'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import api from './api';
import { useAuthStore } from './auth-store';
import type { ApiResponse, CartItem, WishlistItem, Product, AppNotification, Review, ReviewEligibility } from '@/types';

/** Cart & wishlist are server-backed per CUSTOMER account, so every hook here
 * requires an authenticated CUSTOMER — anonymous browsing still works for
 * product listing/detail pages, but interacting with cart/wishlist redirects
 * to login first. */

export function useCart() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['cart'],
    enabled: !!user && user.role === 'CUSTOMER',
    queryFn: async () => (await api.get<ApiResponse<{ items: CartItem[]; subtotal: number; itemCount: number }>>('/cart')).data.data,
  });
}

export function useCartMutations() {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const requireLogin = () => {
    if (!user) {
      toast.error('Please sign in to continue');
      router.push('/login');
      return false;
    }
    return true;
  };

  const addToCart = useMutation({
    mutationFn: (body: { productId: string; variantId?: string; quantity?: number }) => api.post('/cart', body),
    onSuccess: () => { toast.success('Added to cart'); qc.invalidateQueries({ queryKey: ['cart'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not add to cart'),
  });

  const updateQuantity = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.patch(`/cart/${id}`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not update quantity'),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/${id}`),
    onSuccess: () => { toast.success('Removed from cart'); qc.invalidateQueries({ queryKey: ['cart'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not remove item'),
  });

  return {
    addToCart: (body: { productId: string; variantId?: string; quantity?: number }) => {
      if (!requireLogin()) return;
      addToCart.mutate(body);
    },
    updateQuantity,
    removeItem,
    isAdding: addToCart.isPending,
  };
}

export function useWishlist() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['wishlist'],
    enabled: !!user && user.role === 'CUSTOMER',
    queryFn: async () => (await api.get<ApiResponse<WishlistItem[]>>('/wishlist')).data.data,
  });
}

export function useWishlistMutations() {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: wishlist } = useWishlist();

  const requireLogin = () => {
    if (!user) {
      toast.error('Please sign in to continue');
      router.push('/login');
      return false;
    }
    return true;
  };

  const add = useMutation({
    mutationFn: (productId: string) => api.post('/wishlist', { productId }),
    onSuccess: () => { toast.success('Added to wishlist'); qc.invalidateQueries({ queryKey: ['wishlist'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not add to wishlist'),
  });

  const remove = useMutation({
    mutationFn: (productId: string) => api.delete(`/wishlist/${productId}`),
    onSuccess: () => { toast.success('Removed from wishlist'); qc.invalidateQueries({ queryKey: ['wishlist'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not remove item'),
  });

  const isWishlisted = (productId: string) => !!wishlist?.some((w) => w.productId === productId);

  const toggle = (product: Product) => {
    if (!requireLogin()) return;
    if (isWishlisted(product.id)) remove.mutate(product.id);
    else add.mutate(product.id);
  };

  return { toggle, isWishlisted };
}

/** Notifications — bell icon in the header, polled rather than pushed live
 * since there's no socket.io wiring on the frontend yet. */
export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['notifications'],
    enabled: !!user,
    // 30s poll keeps the badge fresh without hammering the API.
    refetchInterval: 30_000,
    queryFn: async () =>
      (await api.get<ApiResponse<{ notifications: AppNotification[]; unreadCount: number }>>('/notifications?limit=20')).data.data,
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();

  const markAsRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { markAsRead, markAllAsRead };
}

/** Product reviews — read is public, writing requires a CUSTOMER with a
 * DELIVERED order for that exact product ("verified purchase"). */
export function useReviewEligibility(productId: string) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['review-eligibility', productId],
    enabled: !!user && user.role === 'CUSTOMER' && !!productId,
    queryFn: async () =>
      (await api.get<ApiResponse<ReviewEligibility>>(`/reviews/products/${productId}/eligibility`)).data.data,
  });
}

export function useReviewMutations(productId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['review-eligibility', productId] });
    qc.invalidateQueries({ queryKey: ['storefront-product'] });
  };

  const submitReview = useMutation({
    mutationFn: (body: { rating: number; comment?: string }) => api.post<ApiResponse<Review>>(`/reviews/products/${productId}`, body),
    onSuccess: () => { toast.success('Review submitted'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not submit review'),
  });

  const deleteReview = useMutation({
    mutationFn: (reviewId: string) => api.delete(`/reviews/${reviewId}`),
    onSuccess: () => { toast.success('Review deleted'); invalidate(); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Could not delete review'),
  });

  return { submitReview, deleteReview };
}
