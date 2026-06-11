import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order, OrderStatus } from '@/types';
import { seedOrders, createId } from '@/utils/seed';
import { calculateCancelFee } from '@/utils/price';

interface OrderState {
  orders: Order[];
  createOrder: (
    data: Partial<Order> & {
      roomId: string;
      guestName: string;
      guestPhone: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      guestCount: number;
      originalAmount: number;
      discountAmount: number;
      finalAmount: number;
      dailyBreakdown: { date: string; price: number }[];
    }
  ) => string;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  payOrder: (id: string) => void;
  confirmOrder: (id: string) => void;
  checkInOrder: (id: string) => void;
  checkOutOrder: (id: string) => void;
  cancelOrder: (
    id: string,
    reason?: string
  ) => { cancelFee: number; refundAmount: number; feeRate: number };
  deleteOrder: (id: string) => void;
  getRoomOrders: (roomId: string, activeOnly?: boolean) => Order[];
  reset: () => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: seedOrders,
      createOrder: (data) => {
        const id = createId('ord');
        const order: Order = {
          ...data,
          id,
          status: data.status || 'pending',
          createdAt: new Date().toISOString().slice(0, 10),
        } as Order;
        set((state) => ({ orders: [...state.orders, order] }));
        return id;
      },
      updateOrder: (id, patch) =>
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      payOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? { ...o, status: 'paid' as OrderStatus, paidAt: new Date().toISOString().slice(0, 10) }
              : o
          ),
        })),
      confirmOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status: 'confirmed' as OrderStatus } : o
          ),
        })),
      checkInOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status: 'checkedIn' as OrderStatus } : o
          ),
        })),
      checkOutOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status: 'checkedOut' as OrderStatus } : o
          ),
        })),
      cancelOrder: (id, reason) => {
        const order = get().orders.find((o) => o.id === id);
        if (!order) return { cancelFee: 0, refundAmount: 0, feeRate: 0 };
        const paid =
          order.status === 'paid' ||
          order.status === 'confirmed' ||
          order.status === 'checkedIn';
        const paidAmount = paid ? order.finalAmount : 0;
        const { cancelFee, refundAmount, feeRate } = calculateCancelFee(
          order.checkIn,
          paidAmount
        );
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'cancelled' as OrderStatus,
                  cancelledAt: new Date().toISOString().slice(0, 10),
                  cancelFee,
                  cancelFeeRate: feeRate,
                  refundAmount,
                  cancelReason: reason,
                }
              : o
          ),
        }));
        return { cancelFee, refundAmount, feeRate };
      },
      deleteOrder: (id) =>
        set((state) => ({ orders: state.orders.filter((o) => o.id !== id) })),
      getRoomOrders: (roomId, activeOnly = true) =>
        get().orders.filter(
          (o) =>
            o.roomId === roomId &&
            (!activeOnly ||
              ['pending', 'paid', 'confirmed', 'checkedIn'].includes(o.status))
        ),
      reset: () => set(() => ({ orders: seedOrders })),
    }),
    { name: 'bnb-orders' }
  )
);
