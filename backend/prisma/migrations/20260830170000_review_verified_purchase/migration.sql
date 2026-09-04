-- Reviews are now restricted to one per (product, customer) and always
-- link back to the reviewing user, so the API can show the reviewer's
-- name and the DB itself refuses a second review for the same product.

-- Existing rows default to APPROVED going forward (was PENDING with no
-- moderation UI ever built, so nothing was reachable via the old default).
ALTER TABLE "reviews" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

-- Add the FK to users (customerId already existed as a plain column).
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One review per customer per product.
CREATE UNIQUE INDEX "reviews_productId_customerId_key" ON "reviews"("productId", "customerId");

CREATE INDEX "reviews_productId_idx" ON "reviews"("productId");
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");
