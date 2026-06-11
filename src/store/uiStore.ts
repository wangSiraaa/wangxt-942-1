import { create } from 'zustand';
import type { UserRole, ToastMessage } from '@/types';

interface UIState {
  currentRole: UserRole;
  setCurrentRole: (r: UserRole) => void;
  toasts: ToastMessage[];
  showToast: (t: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentRole: 'home',
  setCurrentRole: (r) => set({ currentRole: r }),
  toasts: [],
  showToast: (t) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const duration = t.duration ?? 3000;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
      }, duration);
    }
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
