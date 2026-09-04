'use client';

import { useQuery } from '@tanstack/react-query';
import { Package, Warehouse as WarehouseIcon, AlertTriangle, ShoppingCart } from 'lucide-react';
import api from '@/lib/api';
import type { ApiResponse, Product, Inventory, Warehouse } from '@/types';

export default function AdminDashboard() {
  const { data: products } = useQuery({
    queryKey: ['dashboard', 'products'],
    queryFn: async () => (await api.get<ApiResponse<Product[]>>('/products', { params: { limit: 1 } })).data.meta,
  });
  const { data: lowStock } = useQuery({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: async () => (await api.get<ApiResponse<Inventory[]>>('/inventory/low-stock')).data.data,
  });
  const { data: warehouses } = useQuery({
    queryKey: ['dashboard', 'warehouses'],
    queryFn: async () => (await api.get<ApiResponse<Warehouse[]>>('/warehouses', { params: { limit: 1 } })).data.meta,
  });

  const cards = [
    { label: 'Total Products', value: products?.total ?? '—', icon: Package, color: 'bg-primary-50 text-primary-600' },
    { label: 'Low Stock Alerts', value: lowStock?.length ?? '—', icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
    { label: 'Warehouses', value: warehouses?.total ?? '—', icon: WarehouseIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Orders', value: '—', icon: ShoppingCart, color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {!!lowStock?.length && (
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Low Stock Products</h2>
          <div className="space-y-2">
            {lowStock.slice(0, 8).map((i: any) => (
              <div key={i.id} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0">
                <span className="text-gray-800">{i.product?.name}</span>
                <span className="text-amber-600">{i.quantityOnHand} left</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
