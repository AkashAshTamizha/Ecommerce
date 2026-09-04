import { create } from 'zustand';

interface AppliedCoupon {
  code: string;
  title: string;
  discount: number;
}

interface CouponState {
  applied: AppliedCoupon | null;
  setApplied: (coupon: AppliedCoupon) => void;
  clear: () => void;
}

// Deliberately not persisted to storage — the discount is only a preview
// until checkout re-validates it server-side anyway, so it's fine (and
// safer) for this to reset on a full page reload.
export const useCouponStore = create<CouponState>((set) => ({
  applied: null,
  setApplied: (coupon) => set({ applied: coupon }),
  clear: () => set({ applied: null }),
}));
