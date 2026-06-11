import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Maintenance } from '@/types';
import { seedMaintenances, createId } from '@/utils/seed';

interface MaintenanceState {
  maintenances: Maintenance[];
  addMaintenance: (m: Omit<Maintenance, 'id' | 'createdAt' | 'status'>) => string;
  updateMaintenance: (id: string, patch: Partial<Maintenance>) => void;
  deleteMaintenance: (id: string) => void;
  getRoomMaintenances: (roomId: string) => Maintenance[];
  reset: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>()(
  persist(
    (set, get) => ({
      maintenances: seedMaintenances,
      addMaintenance: (m) => {
        const id = createId('mt');
        set((s) => ({
          maintenances: [
            ...s.maintenances,
            { ...m, id, status: 'scheduled', createdAt: new Date().toISOString().slice(0, 10) },
          ],
        }));
        return id;
      },
      updateMaintenance: (id, patch) =>
        set((s) => ({
          maintenances: s.maintenances.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      deleteMaintenance: (id) =>
        set((s) => ({ maintenances: s.maintenances.filter((m) => m.id !== id) })),
      getRoomMaintenances: (roomId) => get().maintenances.filter((m) => m.roomId === roomId),
      reset: () => set({ maintenances: seedMaintenances }),
    }),
    { name: 'bnb-maintenance' }
  )
);
