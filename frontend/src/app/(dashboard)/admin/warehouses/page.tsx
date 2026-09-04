'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Warehouse as WarehouseIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { ApiResponse, Warehouse } from '@/types';

export default function WarehousesPage() {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get<ApiResponse<Warehouse[]>>('/warehouses', { params: { limit: 50 } })).data.data,
  });

  const create = useMutation({
    mutationFn: (body: any) => api.post('/warehouses', body),
    onSuccess: () => {
      toast.success('Warehouse created');
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create warehouse'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Warehouses</h1>
          <p className="text-sm text-gray-500">Manage stock locations</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Warehouse
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {data?.map((w: any) => (
          <div key={w.id} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <WarehouseIcon size={20} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{w.name}</p>
                <p className="text-xs text-gray-400">{w.code}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">{w.city}{w.city && w.state ? ', ' : ''}{w.state}</p>
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span>{w._count?.inventories ?? 0} SKUs stocked</span>
              <span>{w._count?.staff ?? 0} staff</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <AddWarehouseModal
          onClose={() => setShowModal(false)}
          onSubmit={(body) => create.mutate(body)}
          isLoading={create.isPending}
        />
      )}
    </div>
  );
}

function AddWarehouseModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({ name: '', code: '', city: '', state: '', country: 'India', pincode: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Warehouse</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {(['name', 'code', 'city', 'state', 'pincode'] as const).map((field) => (
            <div key={field}>
              <label className="mb-1 block text-sm font-medium capitalize text-gray-700">{field} *</label>
              <input
                value={(form as any)[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={isLoading} onClick={() => onSubmit(form)}>Create</Button>
        </div>
      </div>
    </div>
  );
}
