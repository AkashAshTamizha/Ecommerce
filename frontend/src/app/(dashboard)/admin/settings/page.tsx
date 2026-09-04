'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { ApiResponse, SystemSettings } from '@/types';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SystemSettings | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<ApiResponse<SystemSettings>>('/settings')).data.data,
  });

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const save = useMutation({
    mutationFn: (body: Partial<SystemSettings>) => api.patch('/settings', body),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save settings'),
  });

  if (isLoading || !form) {
    return <p className="text-sm text-gray-400">Loading settings…</p>;
  }

  const setField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Store-wide configuration</p>
      </div>

      <div className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">General</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Store Name</label>
              <input
                value={form.storeName}
                onChange={(e) => setField('storeName', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Support Email</label>
              <input
                value={form.supportEmail}
                onChange={(e) => setField('supportEmail', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setField('currency', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Commerce & Inventory</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default Commission (%)</label>
              <input
                type="number" min={0} max={100}
                value={form.defaultCommissionPct}
                onChange={(e) => setField('defaultCommissionPct', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default Tax (%)</label>
              <input
                type="number" min={0} max={100}
                value={form.taxPct}
                onChange={(e) => setField('taxPct', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Low Stock Threshold</label>
              <input
                type="number" min={0}
                value={form.lowStockThreshold}
                onChange={(e) => setField('lowStockThreshold', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Access & Availability</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Allow seller self-registration</p>
                <p className="text-xs text-gray-500">New sellers can sign up without being invited</p>
              </div>
              <input
                type="checkbox"
                checked={form.allowSellerSelfRegistration}
                onChange={(e) => setField('allowSellerSelfRegistration', e.target.checked)}
                className="h-5 w-9 accent-primary-600"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Maintenance mode</p>
                <p className="text-xs text-gray-500">Temporarily disable customer-facing storefront</p>
              </div>
              <input
                type="checkbox"
                checked={form.maintenanceMode}
                onChange={(e) => setField('maintenanceMode', e.target.checked)}
                className="h-5 w-9 accent-primary-600"
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end border-t border-gray-100 pt-6">
          <Button isLoading={save.isPending} onClick={() => save.mutate(form)}>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
