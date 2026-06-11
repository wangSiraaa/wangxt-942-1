import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Room, HolidayPrice, DiscountRule } from '@/types';
import { seedRooms, seedHolidays, seedDiscounts, createId } from '@/utils/seed';

interface RoomState {
  rooms: Room[];
  holidays: HolidayPrice[];
  discounts: DiscountRule[];
  addRoom: (room: Omit<Room, 'id'>) => string;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  addHoliday: (h: Omit<HolidayPrice, 'id'>) => string;
  updateHoliday: (id: string, patch: Partial<HolidayPrice>) => void;
  deleteHoliday: (id: string) => void;
  addDiscount: (d: Omit<DiscountRule, 'id'>) => string;
  updateDiscount: (id: string, patch: Partial<DiscountRule>) => void;
  deleteDiscount: (id: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      rooms: seedRooms,
      holidays: seedHolidays,
      discounts: seedDiscounts,
      addRoom: (room) => {
        const id = createId('room');
        set((s) => ({ rooms: [...s.rooms, { ...room, id }] }));
        return id;
      },
      updateRoom: (id, patch) =>
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRoom: (id) =>
        set((s) => ({
          rooms: s.rooms.filter((r) => r.id !== id),
          holidays: s.holidays.filter((h) => h.roomId !== id),
          discounts: s.discounts.filter((d) => d.roomId !== id),
        })),
      addHoliday: (h) => {
        const id = createId('hol');
        set((s) => ({ holidays: [...s.holidays, { ...h, id }] }));
        return id;
      },
      updateHoliday: (id, patch) =>
        set((s) => ({ holidays: s.holidays.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      deleteHoliday: (id) => set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) })),
      addDiscount: (d) => {
        const id = createId('dsc');
        set((s) => ({ discounts: [...s.discounts, { ...d, id }] }));
        return id;
      },
      updateDiscount: (id, patch) =>
        set((s) => ({ discounts: s.discounts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
      deleteDiscount: (id) => set((s) => ({ discounts: s.discounts.filter((d) => d.id !== id) })),
      reset: () => set({ rooms: seedRooms, holidays: seedHolidays, discounts: seedDiscounts }),
    }),
    { name: 'bnb-rooms' }
  )
);
