# Variant Selection — Review & Fix Log

## What I checked

I reviewed the full variant flow in your actual project end-to-end:

- `backend/prisma/schema.prisma` — `ProductVariant.attributes` (JSON map)
- `backend/src/controllers/storefront.controller.js` — product detail API
- `backend/src/controllers/product.controller.js` — variant create/update (admin)
- `backend/src/controllers/cart.controller.js` — add/merge cart items
- `frontend/src/app/(store)/products/[slug]/page.tsx` — color/size selector
- `frontend/src/app/(store)/cart/page.tsx`, `checkout/page.tsx`, `store-hooks.ts`

## Finding

**The specific bug you described (selecting White+6 jumping to Black+6) is
NOT present in this snapshot.** The product detail page already matches
variants against the *entire* selected-attributes object:

```ts
const matchingVariant = product?.variants?.find((v) =>
  Object.entries(nextAttrs).every(([k, v2]) => v.attributes?.[k] === v2)
);
```

This is the correct pattern — it checks every selected attribute at once,
so it can't resolve "Color: White, Size: 6" to a Black variant just because
a Black/6 combination also exists. Cart items are also correctly keyed by
`productId + variantId`, not by a single attribute.

## Gap I did find and fixed

Nothing prevented an admin from creating **two variants with the exact same
attribute combination** (e.g. two separate "White / Size 6" rows), and
attribute values weren't normalized (a value saved as `"White "` — with a
trailing space — would silently fail `===` against `"White"` typed
elsewhere). Both of these can reproduce the same *symptom* you saw
(wrong/stuck variant, or a variant that seems impossible to select) even
though the selection code itself is correct — because whichever matching
variant happens to be either accidentally duplicated or subtly
mismatched by whitespace/casing becomes unreachable or inconsistent.

## Files changed

### `backend/src/controllers/product.controller.js`
- Added `normalizeAttributes()` — trims key/value whitespace on save.
- Added `attributesMatch()` / `assertUniqueAttributes()` — rejects creating
  or updating a variant into a combination that already exists on that
  product (`409 Conflict`), enforcing "do not create duplicate variants."
- Applied both in `createVariant` and `updateVariant`.

### `frontend/src/app/(store)/products/[slug]/page.tsx`
- Added `valuesEqual()` / `attributesMatchSelection()` — trimmed,
  case-insensitive comparison used everywhere a variant is matched against
  the current selection (both the actual match and the "is this option
  available" check), so the frontend can't be tripped up by the same
  whitespace/casing issue even if it somehow slipped past the new backend
  validation (e.g. on rows created before this fix).

No database schema changes, no UI/styling changes — only the matching and
validation logic.

## How to verify

1. In the admin product editor, try adding two variants with the same
   attributes (e.g. Color: White, Size: 6, twice) — the second one should
   now be rejected with "A variant with this exact attribute combination
   already exists for this product."
2. On the storefront product page, select White → 6, then Black → 6,
   confirming price/SKU/image/stock switch correctly and never cross over.
3. Try Black → 8 directly (skipping White) to confirm it resolves to the
   Black/8 variant, not White/8.

---

# Notifications + Verified-Purchase Product Reviews — Build Log

## What was missing
- **Notifications**: `notification.service.js` wrote rows to the DB (and would emit
  over socket.io if attached), but there was no API to list/read them and no
  frontend UI at all.
- **Product reviews**: only the `Review` Prisma model existed — no controller,
  no routes, no frontend.
- The "buy" flow (cart → checkout → orders) was already fully built; nothing
  changed there.

## Notifications (simple bell + dropdown, polling)
- `backend/src/controllers/notification.controller.js` +
  `backend/src/routes/notification.routes.js` — `GET /notifications`,
  `GET /notifications/unread-count`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all`. Registered in `app.js`.
- `frontend/src/components/store/NotificationBell.tsx` — bell icon with an
  unread badge, dropdown list, mark-one/mark-all-as-read. Polls every 30s via
  `useNotifications()` in `store-hooks.ts`. Wired into `StoreHeader.tsx` for
  any logged-in user.

## Product reviews (verified purchase only)
A customer can only review a product if they have an order for that product
with status `DELIVERED` — this is the "bought & received" check — and only
once per product (enforced both in the controller and by a DB unique
constraint, so a race between two near-simultaneous requests can't create
two reviews).

- `backend/prisma/schema.prisma` — `Review` now has a `customer` relation
  (for showing the reviewer's name) and `@@unique([productId, customerId])`.
  New migration:
  `backend/prisma/migrations/20260830170000_review_verified_purchase/`.
  **Run `npx prisma migrate deploy` (or `migrate dev` locally) before starting
  the backend.**
- `backend/src/controllers/review.controller.js` +
  `backend/src/routes/review.routes.js`:
  - `GET /reviews/products/:productId` — public, paginated, approved reviews
    + rating breakdown.
  - `GET /reviews/products/:productId/eligibility` — CUSTOMER only; tells the
    frontend whether to show the review form.
  - `POST /reviews/products/:productId` — CUSTOMER only; re-checks the
    DELIVERED-order requirement server-side regardless of what the frontend
    showed. Notifies the seller on success (best-effort, never blocks the
    review).
  - `DELETE /reviews/:id` — CUSTOMER only; own reviews only.
- `frontend/src/app/(store)/products/[slug]/page.tsx` — new `WriteReview`
  section under the existing reviews list: shows nothing to anonymous
  visitors or ineligible customers, a star-rating form to eligible ones, and
  the customer's own review (with delete) if they've already left one.
- `frontend/src/lib/store-hooks.ts` — `useReviewEligibility`,
  `useReviewMutations`, `useNotifications`, `useNotificationMutations`.

## Not built (out of scope for this pass)
- No admin moderation queue for reviews — every review is auto-`APPROVED`,
  matching how they were already being surfaced on the storefront.
- No real-time push for notifications (no socket.io wiring on the frontend);
  the bell polls every 30s instead.

## Follow-up: notifications for every role + a full history page
Previously the bell only lived in the customer storefront header, so
SUPER_ADMIN/SELLER/ACCOUNTANT/STOCK_MANAGER/DELIVERY_AGENT (who live in the
`(dashboard)` layout, which has no header at all) had no way to see their
notifications, even though the backend already creates them for these roles
(e.g. "new order placed" → SUPER_ADMIN, "new delivery assigned" →
DELIVERY_AGENT, "product pending approval" → SUPER_ADMIN).

- `frontend/src/components/layout/Sidebar.tsx` — added a "Notifications" nav
  item (visible to every dashboard role, via `ROUTE_ROLES`) with a live
  unread-count badge.
- `frontend/src/config/access-control.ts` — registered `/admin/notifications`
  for `ALL_ROLES`.
- `frontend/src/components/store/NotificationsList.tsx` — new shared,
  paginated full-history view (all/unread filter, mark one/all as read).
- `frontend/src/app/(dashboard)/admin/notifications/page.tsx` and
  `frontend/src/app/(store)/notifications/page.tsx` — both just render
  `NotificationsList`, one per layout since the two route groups can't share
  a literal path.
- `NotificationBell.tsx` dropdown now has a "View all" link to `/notifications`
  for customers.

Net effect: every role now has notifications, either via `/notifications`
(customers, from the header bell) or `/admin/notifications` (everyone else,
from the sidebar link with its unread badge).
