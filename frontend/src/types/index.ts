export type Role = 'SUPER_ADMIN' | 'SELLER' | 'ACCOUNTANT' | 'STOCK_MANAGER' | 'DELIVERY_AGENT' | 'CUSTOMER';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'DRAFT';
export type SellerStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
export type VendorReturnReason = 'DAMAGED' | 'DEFECTIVE' | 'EXPIRED' | 'WRONG_ITEM' | 'EXCESS_SUPPLY' | 'QUALITY_ISSUE' | 'OTHER';
export type VendorReturnStatus = 'DRAFT' | 'SENT_TO_VENDOR' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';
export type VendorReturnResolution = 'PENDING' | 'CREDIT_NOTE' | 'REPLACEMENT' | 'REFUND' | 'REJECTED';
export type VendorCreditNoteStatus = 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' | 'CANCELLED';
export type ReturnRequestType = 'RETURN' | 'REPLACEMENT';
export type ReturnRequestReason =
  | 'DAMAGED' | 'DEFECTIVE' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED'
  | 'SIZE_FIT_ISSUE' | 'NO_LONGER_NEEDED' | 'QUALITY_ISSUE' | 'OTHER';
export type ReturnRequestStatus =
  | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PICKUP_SCHEDULED' | 'PICKED_UP'
  | 'RECEIVED' | 'REPLACEMENT_SHIPPED' | 'REPLACEMENT_DELIVERED' | 'REFUNDED' | 'CANCELLED';
export type RefundMethod = 'ORIGINAL_PAYMENT_METHOD' | 'STORE_CREDIT' | 'BANK_TRANSFER';
export type OfferType = 'COUPON' | 'AUTOMATIC';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type OfferScope = 'ALL' | 'CATEGORY' | 'BRAND' | 'PRODUCT';
export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type ShipmentStatus =
  | 'CREATED' | 'PACKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'FAILED_DELIVERY' | 'RETURNED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatarUrl?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string;
  seller?: { id: string; storeName: string; status: string };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Brand {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  /** @deprecated legacy free-text URL — use `images` (front/other gallery) instead */
  imageUrl?: string;
  images?: ProductImage[];
  isActive: boolean;
  stock?: number;
}

export interface Review {
  id: string;
  productId: string;
  customerId: string;
  customer?: { id: string; name: string; avatarUrl?: string };
  rating: number;
  comment?: string;
  status?: ApprovalStatus;
  createdAt: string;
}

export interface ReviewEligibility {
  canReview: boolean;
  hasPurchased: boolean;
  alreadyReviewed: boolean;
  existingReview: Review | null;
}

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  shortDesc?: string;
  fullDesc?: string;
  categoryId: string;
  category?: Category;
  brandId?: string;
  brand?: Brand;
  sellerId: string;
  seller?: { id: string; storeName: string; city?: string; state?: string };
  mrp: number;
  sellingPrice: number;
  costPrice?: number;
  /** Real price after the best currently-active AUTOMATIC offer that applies
   * to this product (ALL / CATEGORY / BRAND / PRODUCT scoped). Equal to
   * `sellingPrice` when no offer applies. Computed server-side. */
  effectivePrice?: number;
  /** The offer responsible for `effectivePrice`, if any. Null when no
   * automatic offer currently applies to this product. */
  activeOffer?: {
    id: string;
    title: string;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
  } | null;
  status: ProductStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  minStockLevel: number;
  maxStockLevel: number;
  images: ProductImage[];
  variants?: ProductVariant[];
  reviews?: Review[];
  related?: Product[];
  totalStock?: number;
  inStock?: boolean;
  avgRating?: number | null;
  reviewCount?: number;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  city?: string;
  isActive: boolean;
}

export interface Inventory {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string; minStockLevel?: number; maxStockLevel?: number };
  variantId?: string;
  variant?: { id: string; sku: string; attributes: Record<string, string> };
  warehouseId: string;
  warehouse?: Warehouse;
  quantityOnHand: number;
  quantityReserved: number;
  quantityDamaged?: number;
  accountingOnHand: number;
  accountingReserved: number;
  availableStock?: number;
  accountingAvailable?: number;
  isLowStock?: boolean;
  reorderPoint: number;
  reorderQty?: number;
  binLocation?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  status: SellerStatus;
  gstNumber?: string;
  businessType?: string;
  city?: string;
  state?: string;
  country?: string;
  commissionPct?: number;
  user?: { id: string; name: string; email: string; phone?: string; isActive: boolean };
  _count?: { products: number; warehouses: number };
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gstNumber?: string;
  isActive: boolean;
  _count?: { purchaseOrders: number };
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string };
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendor?: { id: string; name: string };
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  status: PurchaseOrderStatus;
  subtotal: number;
  tax: number;
  totalAmount: number;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  _count?: { items: number };
  createdAt: string;
}

export interface VendorReturnItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string };
  variantId?: string;
  variant?: { id: string; sku: string; attributes: Record<string, string> };
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason?: VendorReturnReason;
  condition?: string;
}

export interface VendorReturn {
  id: string;
  returnNumber: string;
  vendorId: string;
  vendor?: { id: string; name: string; email?: string; phone?: string };
  purchaseOrderId?: string;
  purchaseOrder?: { id: string; poNumber: string };
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  reason: VendorReturnReason;
  status: VendorReturnStatus;
  resolution: VendorReturnResolution;
  totalValue: number;
  notes?: string;
  sentAt?: string;
  resolvedAt?: string;
  items: VendorReturnItem[];
  creditNotes?: VendorCreditNote[];
  _count?: { items: number };
  createdAt: string;
}

export interface VendorCreditNoteApplication {
  id: string;
  purchaseOrderId: string;
  purchaseOrder?: { id: string; poNumber: string };
  amountApplied: number;
  appliedBy?: { id: string; name: string };
  appliedAt: string;
}

export interface VendorCreditNote {
  id: string;
  creditNoteNumber: string;
  vendorId: string;
  vendor?: { id: string; name: string; email?: string };
  vendorReturnId?: string;
  vendorReturn?: { id: string; returnNumber: string; reason?: VendorReturnReason };
  amount: number;
  appliedAmount: number;
  status: VendorCreditNoteStatus;
  issuedDate: string;
  expiryDate?: string;
  notes?: string;
  applications?: VendorCreditNoteApplication[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string; images?: ProductImage[] };
  variantId?: string;
  variant?: { id: string; sku: string; attributes: Record<string, string> };
  quantity: number;
  price: number;
  unitPrice?: number;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  subtotal?: number;
  tax?: number;
  shippingFee?: number;
  totalAmount: number;
  address?: Address;
  shippingAddress?: any;
  items?: OrderItem[];
  shipment?: Shipment;
  _count?: { items: number };
  createdAt: string;
}

export interface ReturnRequestItem {
  id: string;
  orderItemId: string;
  orderItem?: OrderItem;
  quantity: number;
  unitPrice: number;
}

export interface ReturnRequest {
  id: string;
  requestNumber: string;
  orderId: string;
  order?: { id: string; orderNumber: string; status: OrderStatus; totalAmount: number; paymentMethod?: string; paymentStatus: PaymentStatus };
  customerId: string;
  customer?: { id: string; name: string; email: string; phone?: string };
  type: ReturnRequestType;
  reason: ReturnRequestReason;
  status: ReturnRequestStatus;
  customerNotes?: string;
  staffNotes?: string;
  rejectionReason?: string;
  refundAmount?: number;
  refundMethod?: RefundMethod;
  refundedAt?: string;
  replacementCourierName?: string;
  replacementTrackingNumber?: string;
  replacementShippedAt?: string;
  replacementDeliveredAt?: string;
  pickupScheduledAt?: string;
  pickedUpAt?: string;
  receivedAt?: string;
  resolvedBy?: { id: string; name: string };
  items: ReturnRequestItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string; name: string; slug: string; sku: string; sellingPrice: number; mrp: number;
    status: ProductStatus; images: ProductImage[];
  };
  variantId?: string;
  variant?: { id: string; sku: string; attributes: Record<string, string>; price: number; imageUrl?: string; images?: ProductImage[] };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableStock: number;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: {
    id: string; name: string; slug: string; sku: string; sellingPrice: number; mrp: number;
    status: ProductStatus; images: ProductImage[];
  };
  inStock: boolean;
  createdAt: string;
}

export interface ShipmentEvent {
  id: string;
  status: ShipmentStatus;
  note?: string;
  location?: string;
  createdAt: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  order?: { id: string; orderNumber: string; totalAmount: number; status: OrderStatus; customerId?: string; items?: OrderItem[] };
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string; city?: string };
  status: ShipmentStatus;
  courierName?: string;
  courierPhone?: string;
  trackingNumber?: string;
  packageWeightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  deliveryAgentId?: string;
  deliveryAgent?: { id: string; name: string; email?: string; phone?: string };
  shippingAddress?: any;
  estimatedDeliveryDate?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  notes?: string;
  events?: ShipmentEvent[];
  _count?: { events: number };
  createdAt: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  _count?: { shipmentsAssigned: number };
}

export interface SystemSettings {
  storeName: string;
  supportEmail: string;
  currency: string;
  defaultCommissionPct: number;
  lowStockThreshold: number;
  taxPct: number;
  allowSellerSelfRegistration: boolean;
  maintenanceMode: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface Offer {
  id: string;
  title: string;
  description?: string;
  code?: string;
  type: OfferType;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  scope: OfferScope;
  categoryId?: string;
  category?: { id: string; name: string; slug: string };
  brandId?: string;
  brand?: { id: string; name: string };
  productId?: string;
  product?: { id: string; name: string; slug: string };
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  usedCount: number;
  isActive: boolean;
  _count?: { redemptions: number };
  createdAt: string;
}
