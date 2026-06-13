import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  DomainEvent, EventType, UserRole, 
  Property, Room, PriceVersion, HolidayPrice, LongStayDiscount,
  MaintenanceRecord, LockRecord, ReleaseRecord, Order, RefundRecord, AuditLog,
  CalendarDayStatus, PriceCalculationResult, RefundCalculationResult, RevenueForecast, ConflictInfo
} from '../types';
import { calculateDailyPrice, calculatePrice, calculateBatchPriceUpdate } from '../utils/priceCalculator';
import { calculateRefund, calculatePartialRefund } from '../utils/refundCalculator';
import { calculateCalendarStatus, checkAvailability, getAllConflicts } from '../utils/availabilityCalculator';
import { calculateRevenueForecast, generateOrderNo, generateId } from '../utils/revenueCalculator';
import { isHoliday, isWeekend, getDatesBetween, getToday, getMonthStart, getMonthEnd, addDays } from '../utils/dateUtils';

interface BookingState {
  events: DomainEvent[];
  currentRole: UserRole;
  currentUserId: string;
  currentPropertyId: string | null;
  
  properties: Property[];
  rooms: Room[];
  priceVersions: PriceVersion[];
  holidayPrices: HolidayPrice[];
  longStayDiscounts: LongStayDiscount[];
  maintenances: MaintenanceRecord[];
  locks: LockRecord[];
  releases: ReleaseRecord[];
  orders: Order[];
  refunds: RefundRecord[];
  auditLogs: AuditLog[];
  
  calendarStatus: Map<string, CalendarDayStatus>;
  calendarStartDate: string;
  calendarEndDate: string;
  
  selectedRoomIds: string[];
  selectedDate: string | null;
  selectedOrderId: string | null;
  
  setCurrentRole: (role: UserRole) => void;
  setCurrentUserId: (id: string) => void;
  setCurrentPropertyId: (id: string | null) => void;
  setCalendarRange: (start: string, end: string) => void;
  setSelectedRoomIds: (ids: string[]) => void;
  setSelectedDate: (date: string | null) => void;
  setSelectedOrderId: (id: string | null) => void;
  
  applyEvent: (type: EventType, payload: any) => void;
  replayEvents: () => void;
  rebuildCalendar: () => void;
  
  createProperty: (data: Omit<Property, 'id' | 'createdAt'>) => Property;
  createRoom: (data: Omit<Room, 'id' | 'createdAt'>) => Room;
  updateRoom: (id: string, data: Partial<Room>) => void;
  
  createPriceVersion: (data: Omit<PriceVersion, 'id' | 'createdAt'>) => PriceVersion;
  activatePriceVersion: (id: string) => void;
  archivePriceVersion: (id: string) => void;
  setHolidayPrice: (data: Omit<HolidayPrice, 'id' | 'createdAt'>) => HolidayPrice;
  setLongStayDiscount: (data: Omit<LongStayDiscount, 'id' | 'createdAt'>) => LongStayDiscount;
  batchUpdatePrices: (roomIds: string[], startDate: string, endDate: string, adjustment: number, type: 'fixed' | 'percent') => void;
  
  createMaintenance: (data: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => MaintenanceRecord;
  cancelMaintenance: (id: string) => void;
  
  createLock: (data: Omit<LockRecord, 'id' | 'createdAt' | 'releasedAt' | 'releasedBy'>) => LockRecord;
  releaseLock: (id: string) => void;
  createRelease: (data: Omit<ReleaseRecord, 'id' | 'createdAt'>) => ReleaseRecord;
  
  createOrder: (data: Omit<Order, 'id' | 'orderNo' | 'status' | 'lockedPrice' | 'createdAt' | 'updatedAt'> & { priceSnapshot: Order['priceSnapshot'] }) => Order;
  updateOrderStatus: (id: string, newStatus: Order['status']) => void;
  payOrder: (id: string, amount: number) => void;
  lockOrderPrice: (id: string) => void;
  cancelOrder: (id: string, reason: RefundRecord['reason']) => void;
  partialCancelOrder: (id: string, cancelledNights: number, reason: RefundRecord['reason']) => void;
  rescheduleOrder: (id: string, newCheckin: string, newCheckout: string) => void;
  
  calculatePriceForBooking: (roomId: string, checkin: string, checkout: string, existingOrderId?: string) => PriceCalculationResult | null;
  calculateRefundForOrder: (orderId: string, reason: RefundRecord['reason']) => RefundCalculationResult | null;
  getAvailability: (roomId: string, checkin: string, checkout: string) => ReturnType<typeof checkAvailability>;
  getConflicts: () => ConflictInfo[];
  getRevenueForecast: (startDate: string, endDate: string) => RevenueForecast[];
  getDailyPrice: (roomId: string, date: string) => { price: number; basePrice: number; isHoliday: boolean; isWeekend: boolean };
  
  importCalendar: (data: any) => void;
  exportCalendar: () => string;
  
  resetAllData: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      events: [],
      currentRole: 'host',
      currentUserId: 'user_1',
      currentPropertyId: null,
      
      properties: [],
      rooms: [],
      priceVersions: [],
      holidayPrices: [],
      longStayDiscounts: [],
      maintenances: [],
      locks: [],
      releases: [],
      orders: [],
      refunds: [],
      auditLogs: [],
      
      calendarStatus: new Map(),
      calendarStartDate: getMonthStart(getToday()),
      calendarEndDate: addDays(getMonthEnd(getToday()), 30),
      
      selectedRoomIds: [],
      selectedDate: null,
      selectedOrderId: null,
      
      setCurrentRole: (role) => set({ currentRole: role }),
      setCurrentUserId: (id) => set({ currentUserId: id }),
      setCurrentPropertyId: (id) => set({ currentPropertyId: id }),
      setCalendarRange: (start, end) => {
        set({ calendarStartDate: start, calendarEndDate: end });
        get().rebuildCalendar();
      },
      setSelectedRoomIds: (ids) => set({ selectedRoomIds: ids }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setSelectedOrderId: (id) => set({ selectedOrderId: id }),
      
      applyEvent: (type, payload) => {
        const { currentUserId, currentRole } = get();
        const event: DomainEvent = {
          id: generateId('evt_'),
          type,
          payload,
          timestamp: Date.now(),
          operatorId: currentUserId,
          operatorRole: currentRole,
        };
        
        const auditLog: AuditLog = {
          id: generateId('audit_'),
          entityType: type,
          entityId: payload?.id || 'unknown',
          action: type,
          oldValue: null,
          newValue: payload,
          operatorId: currentUserId,
          operatorRole: currentRole,
          createdAt: Date.now(),
        };
        
        set((state) => ({
          events: [...state.events, event],
          auditLogs: [...state.auditLogs, auditLog],
        }));
        
        get().replayEvents();
      },
      
      replayEvents: () => {
        const state = get();
        let properties: typeof state.properties = [];
        let rooms: typeof state.rooms = [];
        let priceVersions: typeof state.priceVersions = [];
        let holidayPrices: typeof state.holidayPrices = [];
        let longStayDiscounts: typeof state.longStayDiscounts = [];
        let maintenances: typeof state.maintenances = [];
        let locks: typeof state.locks = [];
        let releases: typeof state.releases = [];
        let orders: typeof state.orders = [];
        let refunds: typeof state.refunds = [];
        
        for (const event of state.events) {
          switch (event.type) {
            case 'PROPERTY_CREATED':
              properties.push(event.payload);
              break;
            case 'ROOM_CREATED':
              rooms.push(event.payload);
              break;
            case 'ROOM_UPDATED':
              rooms = rooms.map(r => r.id === event.payload.id ? { ...r, ...event.payload.data } : r);
              break;
            case 'PRICE_VERSION_CREATED':
              priceVersions.push(event.payload);
              break;
            case 'PRICE_VERSION_ACTIVATED':
              priceVersions = priceVersions.map(pv => 
                pv.id === event.payload ? { ...pv, status: 'active' } : pv
              );
              break;
            case 'PRICE_VERSION_ARCHIVED':
              priceVersions = priceVersions.map(pv => 
                pv.id === event.payload ? { ...pv, status: 'archived' } : pv
              );
              break;
            case 'HOLIDAY_PRICE_SET':
              holidayPrices = holidayPrices.filter(
                hp => !(hp.roomId === event.payload.roomId && hp.date === event.payload.date)
              );
              holidayPrices.push(event.payload);
              break;
            case 'LONG_STAY_DISCOUNT_SET':
              longStayDiscounts = longStayDiscounts.filter(
                d => !(d.roomId === event.payload.roomId && 
                       d.minNights === event.payload.minNights && 
                       d.maxNights === event.payload.maxNights)
              );
              longStayDiscounts.push(event.payload);
              break;
            case 'MAINTENANCE_CREATED':
              maintenances.push(event.payload);
              break;
            case 'MAINTENANCE_CANCELLED':
              maintenances = maintenances.filter(m => m.id !== event.payload);
              break;
            case 'LOCK_CREATED':
              locks.push(event.payload);
              break;
            case 'LOCK_RELEASED':
              locks = locks.map(l => 
                l.id === event.payload.lockId 
                  ? { ...l, releasedAt: Date.now(), releasedBy: event.payload.operatorId } 
                  : l
              );
              break;
            case 'RELEASE_CREATED':
              releases.push(event.payload);
              break;
            case 'ORDER_CREATED':
              orders.push(event.payload);
              break;
            case 'ORDER_CONFIRMED':
            case 'ORDER_PAID':
            case 'ORDER_LOCKED':
            case 'ORDER_CHECKIN':
            case 'ORDER_CHECKOUT':
            case 'ORDER_COMPLETED':
            case 'ORDER_CANCELLED':
            case 'ORDER_PARTIALLY_CANCELLED':
              orders = orders.map(o => 
                o.id === event.payload.orderId 
                  ? { ...o, status: event.payload.status, updatedAt: Date.now() } 
                  : o
              );
              break;
            case 'ORDER_RESCHEDULED':
              orders = orders.map(o => 
                o.id === event.payload.orderId 
                  ? { 
                      ...o, 
                      checkinDate: event.payload.newCheckin, 
                      checkoutDate: event.payload.newCheckout,
                      rescheduledFrom: o.id,
                      updatedAt: Date.now() 
                    } 
                  : o
              );
              break;
            case 'REFUND_CREATED':
              refunds.push(event.payload);
              break;
            case 'BATCH_PRICE_UPDATED':
              for (const hp of event.payload) {
                holidayPrices = holidayPrices.filter(
                  existing => !(existing.roomId === hp.roomId && existing.date === hp.date)
                );
                holidayPrices.push(hp);
              }
              break;
          }
        }
        
        set({
          properties,
          rooms,
          priceVersions,
          holidayPrices,
          longStayDiscounts,
          maintenances,
          locks,
          releases,
          orders,
          refunds,
        });
        
        get().rebuildCalendar();
      },
      
      rebuildCalendar: () => {
        const { rooms, maintenances, locks, releases, orders, calendarStartDate, calendarEndDate, getDailyPrice } = get();
        
        const calendarStatus = calculateCalendarStatus(
          rooms,
          calendarStartDate,
          calendarEndDate,
          maintenances,
          locks,
          releases,
          orders,
          (roomId, date) => getDailyPrice(roomId, date)
        );
        
        set({ calendarStatus });
      },
      
      createProperty: (data) => {
        const property: Property = {
          ...data,
          id: generateId('prop_'),
          createdAt: Date.now(),
        };
        get().applyEvent('PROPERTY_CREATED', property);
        return property;
      },
      
      createRoom: (data) => {
        const room: Room = {
          ...data,
          id: generateId('room_'),
          createdAt: Date.now(),
        };
        get().applyEvent('ROOM_CREATED', room);
        return room;
      },
      
      updateRoom: (id, data) => {
        get().applyEvent('ROOM_UPDATED', { id, data });
      },
      
      createPriceVersion: (data) => {
        const pv: PriceVersion = {
          ...data,
          id: generateId('pv_'),
          createdAt: Date.now(),
        };
        get().applyEvent('PRICE_VERSION_CREATED', pv);
        return pv;
      },
      
      activatePriceVersion: (id) => {
        get().applyEvent('PRICE_VERSION_ACTIVATED', id);
      },
      
      archivePriceVersion: (id) => {
        get().applyEvent('PRICE_VERSION_ARCHIVED', id);
      },
      
      setHolidayPrice: (data) => {
        const hp: HolidayPrice = {
          ...data,
          id: generateId('hp_'),
          createdAt: Date.now(),
        };
        get().applyEvent('HOLIDAY_PRICE_SET', hp);
        return hp;
      },
      
      setLongStayDiscount: (data) => {
        const discount: LongStayDiscount = {
          ...data,
          id: generateId('lsd_'),
          createdAt: Date.now(),
        };
        get().applyEvent('LONG_STAY_DISCOUNT_SET', discount);
        return discount;
      },
      
      batchUpdatePrices: (roomIds, startDate, endDate, adjustment, type) => {
        const { holidayPrices } = get();
        const newPrices = calculateBatchPriceUpdate(roomIds, startDate, endDate, adjustment, type, holidayPrices);
        get().applyEvent('BATCH_PRICE_UPDATED', newPrices);
      },
      
      createMaintenance: (data) => {
        const maintenance: MaintenanceRecord = {
          ...data,
          id: generateId('mt_'),
          createdAt: Date.now(),
        };
        get().applyEvent('MAINTENANCE_CREATED', maintenance);
        return maintenance;
      },
      
      cancelMaintenance: (id) => {
        get().applyEvent('MAINTENANCE_CANCELLED', id);
      },
      
      createLock: (data) => {
        const lock: LockRecord = {
          ...data,
          id: generateId('lock_'),
          createdAt: Date.now(),
        };
        get().applyEvent('LOCK_CREATED', lock);
        return lock;
      },
      
      releaseLock: (id) => {
        const { currentUserId } = get();
        get().applyEvent('LOCK_RELEASED', { lockId: id, operatorId: currentUserId });
      },
      
      createRelease: (data) => {
        const release: ReleaseRecord = {
          ...data,
          id: generateId('rel_'),
          createdAt: Date.now(),
        };
        get().applyEvent('RELEASE_CREATED', release);
        return release;
      },
      
      createOrder: (data) => {
        const order: Order = {
          ...data,
          id: generateId('order_'),
          orderNo: generateOrderNo(),
          status: 'pending',
          lockedPrice: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        get().applyEvent('ORDER_CREATED', order);
        return order;
      },
      
      updateOrderStatus: (id, newStatus) => {
        const eventMap: Record<string, EventType> = {
          'confirmed': 'ORDER_CONFIRMED',
          'paid': 'ORDER_PAID',
          'locked': 'ORDER_LOCKED',
          'checkin': 'ORDER_CHECKIN',
          'checkout': 'ORDER_CHECKOUT',
          'completed': 'ORDER_COMPLETED',
          'cancelled': 'ORDER_CANCELLED',
          'partially_cancelled': 'ORDER_PARTIALLY_CANCELLED',
        };
        const eventType = eventMap[newStatus];
        if (eventType) {
          get().applyEvent(eventType, { orderId: id, status: newStatus });
        }
      },
      
      payOrder: (id, amount) => {
        const { orders } = get();
        const order = orders.find(o => o.id === id);
        if (order) {
          const updatedOrder = {
            ...order,
            paidAmount: order.paidAmount + amount,
            status: 'paid' as const,
            updatedAt: Date.now(),
          };
          set(state => ({
            orders: state.orders.map(o => o.id === id ? updatedOrder : o),
          }));
          get().applyEvent('ORDER_PAID', { orderId: id, status: 'paid', amount });
        }
      },
      
      lockOrderPrice: (id) => {
        const { orders } = get();
        const order = orders.find(o => o.id === id);
        if (order && !order.lockedPrice) {
          const updatedOrder = {
            ...order,
            lockedPrice: true,
            status: 'locked' as const,
            updatedAt: Date.now(),
          };
          set(state => ({
            orders: state.orders.map(o => o.id === id ? updatedOrder : o),
          }));
          get().applyEvent('ORDER_LOCKED', { orderId: id, status: 'locked' });
        }
      },
      
      cancelOrder: (id, reason) => {
        const { orders, currentUserId } = get();
        const order = orders.find(o => o.id === id);
        if (order) {
          const refundCalc = calculateRefund(order, reason);
          const refund: RefundRecord = {
            id: generateId('refund_'),
            orderId: id,
            amount: order.paidAmount,
            reason,
            daysBeforeCheckin: refundCalc.daysBeforeCheckin,
            usedBenefits: refundCalc.usedBenefits,
            benefitDeduction: refundCalc.benefitDeduction,
            cancelFeeRate: refundCalc.cancelFeeRate,
            cancelFee: refundCalc.cancelFee,
            refundAmount: refundCalc.refundAmount,
            operatorId: currentUserId,
            createdAt: Date.now(),
          };
          
          set(state => ({
            orders: state.orders.map(o => o.id === id ? { ...o, status: 'cancelled', updatedAt: Date.now() } : o),
            refunds: [...state.refunds, refund],
          }));
          
          get().applyEvent('REFUND_CREATED', refund);
          get().applyEvent('ORDER_CANCELLED', { orderId: id, status: 'cancelled' });
        }
      },
      
      partialCancelOrder: (id, cancelledNights, reason) => {
        const { orders, currentUserId } = get();
        const order = orders.find(o => o.id === id);
        if (order) {
          const refundCalc = calculatePartialRefund(order, cancelledNights, 
            Math.ceil((new Date(order.checkoutDate).getTime() - new Date(order.checkinDate).getTime()) / (1000 * 60 * 60 * 24)), 
            reason);
          const refund: RefundRecord = {
            id: generateId('refund_'),
            orderId: id,
            amount: refundCalc.paidAmount,
            reason,
            daysBeforeCheckin: refundCalc.daysBeforeCheckin,
            usedBenefits: refundCalc.usedBenefits,
            benefitDeduction: refundCalc.benefitDeduction,
            cancelFeeRate: refundCalc.cancelFeeRate,
            cancelFee: refundCalc.cancelFee,
            refundAmount: refundCalc.refundAmount,
            operatorId: currentUserId,
            createdAt: Date.now(),
          };
          
          set(state => ({
            orders: state.orders.map(o => o.id === id ? { ...o, status: 'partially_cancelled', updatedAt: Date.now() } : o),
            refunds: [...state.refunds, refund],
          }));
          
          get().applyEvent('REFUND_CREATED', refund);
          get().applyEvent('ORDER_PARTIALLY_CANCELLED', { orderId: id, status: 'partially_cancelled' });
        }
      },
      
      rescheduleOrder: (id, newCheckin, newCheckout) => {
        get().applyEvent('ORDER_RESCHEDULED', { orderId: id, newCheckin, newCheckout });
      },
      
      calculatePriceForBooking: (roomId, checkin, checkout, existingOrderId) => {
        const { rooms, priceVersions, holidayPrices, longStayDiscounts, orders } = get();
        const room = rooms.find(r => r.id === roomId);
        if (!room) return null;
        
        const existingOrder = existingOrderId ? orders.find(o => o.id === existingOrderId) : null;
        
        return calculatePrice(
          room, checkin, checkout, priceVersions, holidayPrices, longStayDiscounts, existingOrder
        );
      },
      
      calculateRefundForOrder: (orderId, reason) => {
        const { orders } = get();
        const order = orders.find(o => o.id === orderId);
        if (!order) return null;
        return calculateRefund(order, reason);
      },
      
      getAvailability: (roomId, checkin, checkout) => {
        const { calendarStatus } = get();
        return checkAvailability(roomId, checkin, checkout, calendarStatus);
      },
      
      getConflicts: () => {
        const { calendarStatus } = get();
        return getAllConflicts(calendarStatus);
      },
      
      getRevenueForecast: (startDate, endDate) => {
        const { rooms, orders, calendarStatus } = get();
        return calculateRevenueForecast(
          rooms, orders, startDate, endDate,
          (roomId, date) => calendarStatus.get(`${roomId}_${date}`)
        );
      },
      
      getDailyPrice: (roomId, date) => {
        const { rooms, priceVersions, holidayPrices } = get();
        const room = rooms.find(r => r.id === roomId);
        if (!room) {
          return { price: 0, basePrice: 0, isHoliday: false, isWeekend: false };
        }
        
        const result = calculateDailyPrice(room, date, priceVersions, holidayPrices);
        return {
          price: result.finalPrice,
          basePrice: result.basePrice,
          isHoliday: isHoliday(date),
          isWeekend: isWeekend(date),
        };
      },
      
      importCalendar: (data) => {
        const { applyEvent, resetAllData } = get();
        
        if (!data) {
          throw new Error('导入数据为空');
        }

        if (data.rooms && Array.isArray(data.rooms)) {
          for (const room of data.rooms) {
            applyEvent('ROOM_CREATED', {
              id: room.id,
              propertyId: room.propertyId,
              name: room.name,
              roomNumber: room.roomNumber,
              basePrice: room.basePrice,
              maxGuests: room.maxGuests,
              bedCount: room.bedCount,
              area: room.area,
              amenities: room.amenities || [],
              createdAt: room.createdAt || Date.now(),
            });
          }
        }

        if (data.holidayPrices && Array.isArray(data.holidayPrices)) {
          for (const hp of data.holidayPrices) {
            applyEvent('HOLIDAY_PRICE_SET', {
              id: hp.id,
              roomId: hp.roomId,
              date: hp.date,
              price: hp.price,
              reason: hp.reason || '导入',
              createdAt: hp.createdAt || Date.now(),
            });
          }
        }

        if (data.maintenances && Array.isArray(data.maintenances)) {
          for (const mt of data.maintenances) {
            applyEvent('MAINTENANCE_CREATED', {
              id: mt.id,
              roomId: mt.roomId,
              startDate: mt.startDate,
              endDate: mt.endDate,
              type: mt.type,
              reason: mt.reason || '导入',
              operatorId: mt.operatorId || 'system',
              createdAt: mt.createdAt || Date.now(),
            });
          }
        }

        if (data.locks && Array.isArray(data.locks)) {
          for (const lock of data.locks) {
            applyEvent('LOCK_CREATED', {
              id: lock.id,
              roomId: lock.roomId,
              startDate: lock.startDate,
              endDate: lock.endDate,
              reason: lock.reason || '导入',
              lockedBy: lock.lockedBy || 'system',
              createdAt: lock.createdAt || Date.now(),
              releasedAt: lock.releasedAt,
              releasedBy: lock.releasedBy,
            });
            if (lock.releasedAt) {
              applyEvent('LOCK_RELEASED', {
                lockId: lock.id,
                operatorId: lock.releasedBy || 'system',
              });
            }
          }
        }

        if (data.releases && Array.isArray(data.releases)) {
          for (const rel of data.releases) {
            applyEvent('RELEASE_CREATED', {
              id: rel.id,
              roomId: rel.roomId,
              date: rel.date,
              reason: rel.reason || '导入',
              operatorId: rel.operatorId || 'system',
              createdAt: rel.createdAt || Date.now(),
            });
          }
        }

        if (data.orders && Array.isArray(data.orders)) {
          for (const order of data.orders) {
            applyEvent('ORDER_CREATED', {
              id: order.id,
              orderNo: order.orderNo,
              roomId: order.roomId,
              guestId: order.guestId,
              guestName: order.guestName,
              guestPhone: order.guestPhone,
              checkinDate: order.checkinDate,
              checkoutDate: order.checkoutDate,
              actualCheckin: order.actualCheckin,
              actualCheckout: order.actualCheckout,
              guestCount: order.guestCount,
              priceSnapshot: order.priceSnapshot,
              paidAmount: order.paidAmount,
              status: 'pending',
              lockedPrice: order.lockedPrice,
              createdAt: order.createdAt || Date.now(),
              updatedAt: order.updatedAt || Date.now(),
              parentOrderId: order.parentOrderId,
              rescheduledFrom: order.rescheduledFrom,
            });
            
            if (order.status !== 'pending') {
              const statusEventMap: Record<string, EventType> = {
                'confirmed': 'ORDER_CONFIRMED',
                'paid': 'ORDER_PAID',
                'locked': 'ORDER_LOCKED',
                'checkin': 'ORDER_CHECKIN',
                'checkout': 'ORDER_CHECKOUT',
                'completed': 'ORDER_COMPLETED',
                'cancelled': 'ORDER_CANCELLED',
                'partially_cancelled': 'ORDER_PARTIALLY_CANCELLED',
              };
              const eventType = statusEventMap[order.status];
              if (eventType) {
                applyEvent(eventType, { orderId: order.id, status: order.status });
              }
            }
          }
        }

        if (data.priceVersions && Array.isArray(data.priceVersions)) {
          for (const pv of data.priceVersions) {
            applyEvent('PRICE_VERSION_CREATED', {
              id: pv.id,
              roomId: pv.roomId,
              name: pv.name,
              startDate: pv.startDate,
              endDate: pv.endDate,
              basePrice: pv.basePrice,
              weekendPremium: pv.weekendPremium,
              holidayPremium: pv.holidayPremium,
              status: 'draft',
              createdAt: pv.createdAt || Date.now(),
              createdBy: pv.createdBy || 'system',
            });
            if (pv.status === 'active') {
              applyEvent('PRICE_VERSION_ACTIVATED', pv.id);
            } else if (pv.status === 'archived') {
              applyEvent('PRICE_VERSION_ARCHIVED', pv.id);
            }
          }
        }

        if (data.properties && Array.isArray(data.properties)) {
          for (const prop of data.properties) {
            applyEvent('PROPERTY_CREATED', {
              id: prop.id,
              name: prop.name,
              address: prop.address,
              description: prop.description,
              hostId: prop.hostId,
              createdAt: prop.createdAt || Date.now(),
            });
          }
        }
      },
      
      exportCalendar: () => {
        const { rooms, calendarStatus, holidayPrices, maintenances, locks, orders, selectedRoomIds } = get();
        const exportRooms = selectedRoomIds.length > 0 ? selectedRoomIds : rooms.map(r => r.id);
        
        const exportData = {
          exportDate: new Date().toISOString(),
          rooms: rooms.filter(r => exportRooms.includes(r.id)),
          calendarData: Array.from(calendarStatus.entries())
            .filter(([key]) => exportRooms.some(rid => key.startsWith(rid + '_')))
            .map(([key, value]) => ({ key, ...value })),
          holidayPrices: holidayPrices.filter(hp => exportRooms.includes(hp.roomId)),
          maintenances: maintenances.filter(m => exportRooms.includes(m.roomId)),
          locks: locks.filter(l => exportRooms.includes(l.roomId)),
          orders: orders.filter(o => exportRooms.includes(o.roomId)),
        };
        
        return JSON.stringify(exportData, null, 2);
      },
      
      resetAllData: () => {
        set({
          events: [],
          currentRole: 'host',
          currentUserId: 'user_1',
          currentPropertyId: null,
          properties: [],
          rooms: [],
          priceVersions: [],
          holidayPrices: [],
          longStayDiscounts: [],
          maintenances: [],
          locks: [],
          releases: [],
          orders: [],
          refunds: [],
          auditLogs: [],
          calendarStatus: new Map(),
          selectedRoomIds: [],
          selectedDate: null,
          selectedOrderId: null,
        });
        localStorage.removeItem('booking-storage');
        get().replayEvents();
        get().rebuildCalendar();
        localStorage.removeItem('booking-storage');
      },
    }),
    {
      name: 'booking-storage',
      partialize: (state) => ({
        events: state.events,
        currentRole: state.currentRole,
        currentUserId: state.currentUserId,
        currentPropertyId: state.currentPropertyId,
        properties: state.properties,
        rooms: state.rooms,
        priceVersions: state.priceVersions,
        holidayPrices: state.holidayPrices,
        longStayDiscounts: state.longStayDiscounts,
        maintenances: state.maintenances,
        locks: state.locks,
        releases: state.releases,
        orders: state.orders,
        refunds: state.refunds,
        auditLogs: state.auditLogs,
        calendarStartDate: state.calendarStartDate,
        calendarEndDate: state.calendarEndDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.replayEvents();
        }
      },
    }
  )
);
