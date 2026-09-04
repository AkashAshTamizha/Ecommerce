'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { ApiResponse, Vendor } from '@/types';

const EMPTY_FORM = {
  name: '', contactPerson: '', email: '', phone: '',
  addressLine: '', city: '', state: '', country: 'India', pincode: '', gstNumber: '',
};

export default function VendorsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', page, search],
    queryFn: async () =>
      (await api.get<ApiResponse<Vendor[]>>('/vendors', { params: { page, limit: 10, q: search || undefined } })).data,
  });

  const create = useMutation({
    mutationFn: (body: any) => api.post('/vendors', body),
    onSuccess: () => {
      toast.success('Vendor created');
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create vendor'),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/vendors/${id}`, body),
    onSuccess: () => {
      toast.success('Vendor updated');
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setShowModal(false);
      setEditing(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update vendor'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/vendors/${id}`),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Vendor removed');
      qc.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove vendor'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500">Suppliers you purchase stock from</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Add Vendor
        </Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search vendors by name, email, contact..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Purchase Orders</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading vendors…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No vendors found.</td></tr>
              )}
              {data?.data.map((vendor) => (
                <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{vendor.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{vendor.contactPerson || '—'}</div>
                    <div className="text-xs text-gray-400">{vendor.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{[vendor.city, vendor.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{vendor._count?.purchaseOrders ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${vendor.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {vendor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(vendor); setShowModal(true); }}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Remove this vendor?')) remove.mutate(vendor.id); }}
                        className="rounded-md p-1.5 text-danger hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      {showModal && (
        <VendorModal
          vendor={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSubmit={(body) => (editing ? update.mutate({ id: editing.id, body }) : create.mutate(body))}
          isLoading={create.isPending || update.isPending}
        />
      )}
    </div>
  );
}

function VendorModal({
  vendor, onClose, onSubmit, isLoading,
}: { vendor: Vendor | null; onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState(
    vendor
      ? {
          name: vendor.name, contactPerson: vendor.contactPerson || '', email: vendor.email || '',
          phone: vendor.phone || '', addressLine: vendor.addressLine || '', city: vendor.city || '',
          state: vendor.state || '', country: vendor.country || 'India', pincode: vendor.pincode || '',
          gstNumber: vendor.gstNumber || '',
        }
      : EMPTY_FORM
  );

  const fields: { key: keyof typeof form; label: string; required?: boolean }[] = [
    { key: 'name', label: 'Vendor Name', required: true },
    { key: 'contactPerson', label: 'Contact Person' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'addressLine', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'gstNumber', label: 'GST Number' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{vendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ key, label, required }) => (
            <div key={key} className={key === 'name' || key === 'addressLine' ? 'col-span-2' : ''}>
              <label className="mb-1 block text-sm font-medium text-gray-700">{label}{required && ' *'}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() => {
              if (!form.name.trim()) { toast.error('Vendor name is required'); return; }
              onSubmit(form);
            }}
          >
            {vendor ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
