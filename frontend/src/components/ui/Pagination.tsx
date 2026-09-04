'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types';

interface Props {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: Props) {
  const { page, totalPages, hasNextPage, hasPrevPage, total, limit } = meta;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
      <p className="text-sm text-gray-500">
        Showing {from} to {to} of {total} results
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevPage}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} />
        </button>

        {pageNumbers.map((p, idx) => {
          const prev = pageNumbers[idx - 1];
          const showEllipsis = prev && p - prev > 1;
          return (
            <span key={p} className="flex items-center">
              {showEllipsis && <span className="px-1 text-gray-400">…</span>}
              <button
                onClick={() => onPageChange(p)}
                className={`h-8 w-8 rounded-md text-sm font-medium ${
                  p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            </span>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
