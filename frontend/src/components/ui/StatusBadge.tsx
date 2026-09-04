import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  APPROVED: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-green-100 text-green-700',
  PAID: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  INACTIVE: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  OUT_OF_STOCK: 'bg-red-100 text-red-700',
  LOW_STOCK: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-gray-100 text-gray-600',

  // Vendor return lifecycle
  SENT_TO_VENDOR: 'bg-blue-100 text-blue-700',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-700',
  RESOLVED: 'bg-green-100 text-green-700',

  // Vendor return resolution (how the vendor responded)
  CREDIT_NOTE: 'bg-purple-100 text-purple-700',
  REPLACEMENT: 'bg-blue-100 text-blue-700',
  REFUND: 'bg-green-100 text-green-700',

  // Vendor credit note status
  OPEN: 'bg-blue-100 text-blue-700',
  PARTIALLY_APPLIED: 'bg-amber-100 text-amber-700',
  APPLIED: 'bg-green-100 text-green-700',

  // Customer return/replacement request lifecycle
  REQUESTED: 'bg-amber-100 text-amber-700',
  PICKUP_SCHEDULED: 'bg-indigo-100 text-indigo-700',
  PICKED_UP: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-indigo-100 text-indigo-700',
  REPLACEMENT_SHIPPED: 'bg-blue-100 text-blue-700',
  REPLACEMENT_DELIVERED: 'bg-green-100 text-green-700',
  REFUNDED: 'bg-green-100 text-green-700',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize', style)}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}
