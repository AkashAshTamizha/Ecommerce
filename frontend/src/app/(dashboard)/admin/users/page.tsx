'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Ban, CheckCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useAuthStore } from '@/lib/auth-store';
import type { ApiResponse, User, Role } from '@/types';

const ROLES: Role[] = ['SUPER_ADMIN', 'SELLER', 'ACCOUNTANT', 'STOCK_MANAGER', 'DELIVERY_AGENT', 'CUSTOMER'];

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  SELLER: 'bg-blue-100 text-blue-700',
  ACCOUNTANT: 'bg-teal-100 text-teal-700',
  STOCK_MANAGER: 'bg-amber-100 text-amber-700',
  DELIVERY_AGENT: 'bg-pink-100 text-pink-700',
  CUSTOMER: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, role],
    queryFn: async () =>
      (
        await api.get<ApiResponse<User[]>>('/users', {
          params: { page, limit: 10, q: search || undefined, role: role || undefined },
        })
      ).data,
  });

  const create = useMutation({
    mutationFn: (body: any) => api.post('/users', body),
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create user'),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, newRole }: { id: string; newRole: string }) => api.patch(`/users/${id}`, { role: newRole }),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update role'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      api.patch(`/users/${id}/${activate ? 'activate' : 'deactivate'}`),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">Manage accounts and role-based access</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add User
        </Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Login</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading users…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No users found.</td></tr>
              )}
              {data?.data.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={u.id === currentUser?.id}
                      onChange={(e) => changeRole.mutate({ id: u.id, newRole: e.target.value })}
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium capitalize disabled:opacity-60 ${ROLE_STYLES[u.role] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.id !== currentUser?.id && (
                        u.isActive ? (
                          <button
                            title="Deactivate"
                            onClick={() => toggleActive.mutate({ id: u.id, activate: false })}
                            className="rounded-md p-1.5 text-danger hover:bg-red-50"
                          >
                            <Ban size={16} />
                          </button>
                        ) : (
                          <button
                            title="Activate"
                            onClick={() => toggleActive.mutate({ id: u.id, activate: true })}
                            className="rounded-md p-1.5 text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )
                      )}
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
        <AddUserModal onClose={() => setShowModal(false)} onSubmit={(body) => create.mutate(body)} isLoading={create.isPending} />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSubmit, isLoading }: { onClose: () => void; onSubmit: (b: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'CUSTOMER' as Role });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role *</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={isLoading}
            onClick={() => {
              if (!form.name || !form.email || !form.password) { toast.error('Name, email and password are required'); return; }
              onSubmit(form);
            }}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
