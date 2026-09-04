import { create } from 'zustand';
import Cookies from 'js-cookie';
import api from './api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string; role?: string }) => Promise<User>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user, accessToken } = res.data.data;
    Cookies.set('accessToken', accessToken, { expires: 1 / 96 }); // 15 min
    set({ user, isLoading: false });
    return user;
  },

  register: async (data) => {
    const res = await api.post('/auth/register', data);
    const { user, accessToken } = res.data.data;
    Cookies.set('accessToken', accessToken, { expires: 1 / 96 });
    set({ user, isLoading: false });
    return user;
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => null);
    Cookies.remove('accessToken');
    set({ user: null });
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.data.user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
