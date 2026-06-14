import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  DomainEvent, EventType, UserRole, 
  Property, Room, PriceVersion, HolidayPrice, LongStayDiscount,
  MaintenanceRecord, LockRecord, ReleaseRecord, Order, RefundRecord, AuditLog,
  CalendarDayStatus, PriceCalculationResult, RefundCalculationResult, RevenueForecast, ConflictInfo,
  ChannelConfig, ChannelInventorySnapshot, PricingSuggestion, AvailabilityExplanation,
  RescheduleValidationResult, PartialCancelValidationResult, BatchPriceProtectionResult,
  ExceptionQueueItem, DetailedAuditLog, HistoricalOccupancyRecord, CleaningSchedule,
  OrderChannelInfo, ChannelType, ExceptionStatus, ExceptionType,
} from '../types';
import { calculateDailyPrice, calculatePrice, calculateBatchPriceUpdate } from '../utils/priceCalculator';
import { calculateRefund, calculatePartialRefund } from '../utils/refundCalculator';
import { calculateCalendarStatus, checkAvailability, getAllConflicts } from '../utils/availabilityCalculator';
import { calculateRevenueForecast, generateOrderNo, generateId } from '../utils/revenueCalculator';
import { isHoliday, isWeekend, getToday, getMonthStart, getMonthEnd, addDays } from '../utils/dateUtils';
import { createDefaultChannelConfig, calculateAllChannelSnapshots } from '../utils/channelInventory';
import { generateBulkPricingSuggestions, applyPricingSuggestion, generateHistoricalOccupancyData, generateCleaningSchedule } from '../utils/pricingEngine';
import { explainAvailability, batchExplainAvailability, formatSaleStatusText, getSaleStatusColor } from '../utils/availabilityExplanation';
import { validateReschedule, validatePartialCancel } from '../utils/rescheduleValidator';
import { executeProtectedBatchPriceUpdate, formatBatchPriceSummary, validatePriceAdjustment, findProtectedOrders } from '../utils/batchPriceProtector';
import { createException, updateExceptionStatus, assignException, runAllExceptionDetectors, createDetailedAuditLog, filterExceptions, getExceptionStats } from '../utils/exceptionQueue';

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
  channelConfigs: ChannelConfig[];
  orderChannelInfos: OrderChannelInfo[];
  pricingSuggestions: PricingSuggestion[];
  exceptionQueue: ExceptionQueueItem[];
  detailedAuditLogs: DetailedAuditLog[];
  cleaningSchedules: CleaningSchedule[];
  historicalOccupancies: HistoricalOccupancyRecord[];
  
  calendarStatus: Map<string, CalendarDayStatus>;
  availabilityExplanations: Map<string, AvailabilityExplanation>;
  channelSnapshots: Map<string, ChannelInventorySnapshot>;
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
  rebuildDerivedData: () => void;
  
  createProperty: (data: Omit<Property, 'id' | 'createdAt'>) => Property;
  createRoom: (data: Omit<Room, 'id' | 'createdAt'>) => Room;
  updateRoom: (id: string, data: Partial<Room>) => void;
  
  createPriceVersion: (data: Omit<PriceVersion, 'id' | 'createdAt'>) => PriceVersion;
  activatePriceVersion: (id: string) => { updatedCount: number; affectedOrders: Array<{ orderId: string; orderNo: string; guestName: string; oldPrice: number; newPrice: number }> };
  archivePriceVersion: (id: string) => void;
  setHolidayPrice: (data: Omit<HolidayPrice, 'id' | 'createdAt'>) => { holidayPrice: HolidayPrice; recalcResult: { updatedCount: number; affectedOrders: Array<{ orderId: string; orderNo: string; guestName: string; oldPrice: number; newPrice: number }> } };
  setLongStayDiscount: (data: Omit<LongStayDiscount, 'id' | 'createdAt'>) => { discount: LongStayDiscount; recalcResult: { updatedCount: number; affectedOrders: Array<{ orderId: string; orderNo: string; guestName: string; oldPrice: number; newPrice: number }> } };
  batchUpdatePrices: (roomIds: string[], startDate: string, endDate: string, adjustment: number, type: 'fixed' | 'percent') => { updatedCount: number; affectedOrders: Array<{ orderId: string; orderNo: string; guestName: string; oldPrice: number; newPrice: number }> };
  protectedBatchUpdatePrices: (roomIds: string[], startDate: string, endDate: string, adjustment: number, type: 'fixed' | 'percent') => BatchPriceProtectionResult & { updatedPrices: HolidayPrice[] };
  validatePriceAdjustmentParams: (adjustment: number, type: 'fixed' | 'percent', currentAvgPrice: number) => { valid: boolean; reason?: string };
  findProtectedOrdersForRange: (roomIds: string[], startDate: string, endDate: string) => ReturnType<typeof findProtectedOrders>;
  
  createMaintenance: (data: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => MaintenanceRecord;
  cancelMaintenance: (id: string) => void;
  
  createLock: (data: Omit<LockRecord, 'id' | 'createdAt' | 'releasedAt' | 'releasedBy'>) => LockRecord;
  releaseLock: (id: string) => void;
  createRelease: (data: Omit<ReleaseRecord, 'id' | 'createdAt'>) => ReleaseRecord;
  
  createOrder: (data: any) => Order;
  updateOrderStatus: (id: string, newStatus: Order['status']) => void;
  payOrder: (id: string, amount: number) => void;
  lockOrderPrice: (id: string) => void;
  cancelOrder: (id: string, reason: RefundRecord['reason']) => void;
  partialCancelOrder: (id: string, cancelledNights: number, cancelCheckinDate: string, cancelCheckoutDate: string, reason: RefundRecord['reason']) => { validation: PartialCancelValidationResult; success: boolean };
  rescheduleOrder: (id: string, newCheckin: string, newCheckout: string) => { validation: RescheduleValidationResult; success: boolean };
  validateOrderReschedule: (orderId: string, newCheckin: string, newCheckout: string) => RescheduleValidationResult | null;
  validateOrderPartialCancel: (orderId: string, cancelCheckin: string, cancelCheckout: string) => PartialCancelValidationResult | null;
  
  calculatePriceForBooking: (roomId: string, checkin: string, checkout: string, existingOrderId?: string) => PriceCalculationResult | null;
  calculateRefundForOrder: (orderId: string, reason: RefundRecord['reason']) => RefundCalculationResult | null;
  getDynamicOrderPrice: (orderId: string) => { currentPrice: PriceCalculationResult; snapshotPrice: PriceCalculationResult; isLocked: boolean; priceChanged: boolean };
  recalculateUnlockedOrderPrices: () => { updatedCount: number; affectedOrders: Array<{ orderId: string; orderNo: string; guestName: string; oldPrice: number; newPrice: number }> };
  getAvailability: (roomId: string, checkin: string, checkout: string) => ReturnType<typeof checkAvailability>;
  getConflicts: () => ConflictInfo[];
  getRevenueForecast: (startDate: string, endDate: string) => RevenueForecast[];
  getDailyPrice: (roomId: string, date: string) => { price: number; basePrice: number; isHoliday: boolean; isWeekend: boolean };

  getAvailabilityExplanation: (roomId: string, date: string) => AvailabilityExplanation | null;
  getAllAvailabilityExplanations: () => Map<string, AvailabilityExplanation>;
  formatSaleStatus: (status: AvailabilityExplanation['saleStatus']) => { text: string; color: string };
  
  createOrUpdateChannelConfig: (roomId: string, channel: ChannelType, config: Partial<ChannelConfig>) => ChannelConfig;
  initDefaultChannelConfigs: (roomId: string) => ChannelConfig[];
  getAllChannelSnapshots: () => Map<string, ChannelInventorySnapshot>;
  getChannelSnapshotsAt: (roomId: string, date: string) => ChannelInventorySnapshot[];
  checkChannelOversellForRoom: (roomId: string, date: string) => { hasOversell: boolean; oversoldUnits: number; channel?: ChannelType };
  assignOrderChannel: (orderId: string, channel: ChannelType, channelOrderIdOrCommission?: string | number, commissionAmount?: number) => void;
  getOrderChannel: (orderId: string) => OrderChannelInfo | null;

  generatePricingSuggestions: (roomIds: string[], startDate: string, endDate: string) => PricingSuggestion[];
  applySinglePricingSuggestion: (suggestionId: string) => { success: boolean; holidayPrice?: HolidayPrice };
  rejectPricingSuggestion: (suggestionId: string) => void;
  getPricingSuggestions: (roomId?: string) => PricingSuggestion[];

  runExceptionDetection: () => ExceptionQueueItem[];
  updateException: (exceptionId: string, status: ExceptionStatus, operatorId?: string, operatorRole?: UserRole, note?: string) => ExceptionQueueItem | null;
  assignExceptionTo: (exceptionId: string, assigneeId: string, operatorId?: string, operatorRole?: UserRole, note?: string) => ExceptionQueueItem | null;
  getExceptionQueue: (filters?: Parameters<typeof filterExceptions>[1]) => ExceptionQueueItem[];
  getExceptionStatsSummary: () => ReturnType<typeof getExceptionStats>;
  getExceptionsByType: (type: ExceptionType) => ExceptionQueueItem[];

  addDetailedAuditLog: (params: Omit<Parameters<typeof createDetailedAuditLog>[0], 'operatorId' | 'operatorRole'>) => DetailedAuditLog;
  getDetailedAuditLogs: (limitOrFilters?: number | { category?: string; roomId?: string; orderId?: string }) => DetailedAuditLog[];

  generateHistoricalData: (roomIdsOrDays: string[] | number, daysBackParam?: number) => HistoricalOccupancyRecord[];
  generateCleaningSchedulesForRange: (startDate: string, endDate: string) => CleaningSchedule[];
  updateCleaningStatus: (scheduleId: string, status: CleaningSchedule['status'], notes?: string) => CleaningSchedule | null;
  
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
      channelConfigs: [],
      orderChannelInfos: [],
      pricingSuggestions: [],
      exceptionQueue: [],
      detailedAuditLogs: [],
      cleaningSchedules: [],
      historicalOccupancies: [],
      
      calendarStatus: new Map(),
      availabilityExplanations: new Map(),
      channelSnapshots: new Map(),
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
        get().rebuildDerivedData();
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
        get().rebuildDerivedData();
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
            case 'PROPERTY_CREATED': properties.push(event.payload); break;
            case 'ROOM_CREATED': rooms.push(event.payload); break;
            case 'ROOM_UPDATED': rooms = rooms.map(r => r.id === event.payload.id ? { ...r, ...event.payload.data } : r); break;
            case 'PRICE_VERSION_CREATED': priceVersions.push(event.payload); break;
            case 'PRICE_VERSION_ACTIVATED': priceVersions = priceVersions.map(pv => pv.id === event.payload ? { ...pv, status: 'active' } : pv); break;
            case 'PRICE_VERSION_ARCHIVED': priceVersions = priceVersions.map(pv => pv.id === event.payload ? { ...pv, status: 'archived' } : pv); break;
            case 'HOLIDAY_PRICE_SET':
              holidayPrices = holidayPrices.filter(hp => !(hp.roomId === event.payload.roomId && hp.date === event.payload.date));
              holidayPrices.push(event.payload); break;
            case 'LONG_STAY_DISCOUNT_SET':
              longStayDiscounts = longStayDiscounts.filter(d => !(d.roomId === event.payload.roomId && d.minNights === event.payload.minNights && d.maxNights === event.payload.maxNights));
              longStayDiscounts.push(event.payload); break;
            case 'MAINTENANCE_CREATED': maintenances.push(event.payload); break;
            case 'MAINTENANCE_CANCELLED': maintenances = maintenances.filter(m => m.id !== event.payload); break;
            case 'LOCK_CREATED': locks.push(event.payload); break;
            case 'LOCK_RELEASED': locks = locks.map(l => l.id === event.payload.lockId ? { ...l, releasedAt: Date.now(), releasedBy: event.payload.operatorId } : l); break;
            case 'RELEASE_CREATED': releases.push(event.payload); break;
            case 'ORDER_CREATED': orders.push(event.payload); break;
            case 'ORDER_CONFIRMED':
            case 'ORDER_PAID':
            case 'ORDER_LOCKED':
            case 'ORDER_CHECKIN':
            case 'ORDER_CHECKOUT':
            case 'ORDER_COMPLETED':
            case 'ORDER_CANCELLED':
            case 'ORDER_PARTIALLY_CANCELLED':
              orders = orders.map(o => o.id === event.payload.orderId ? { ...o, status: event.payload.status, updatedAt: Date.now() } : o); break;
            case 'ORDER_RESCHEDULED':
              orders = orders.map(o => o.id === event.payload.orderId ? { ...o, checkinDate: event.payload.newCheckin, checkoutDate: event.payload.newCheckout, rescheduledFrom: o.id, updatedAt: Date.now() } : o); break;
            case 'ORDER_PRICE_RECALCULATED':
              orders = orders.map(o => o.id === event.payload.orderId ? { ...o, priceSnapshot: event.payload.newSnapshot, updatedAt: Date.now() } : o); break;
            case 'REFUND_CREATED': refunds.push(event.payload); break;
            case 'BATCH_PRICE_UPDATED':
              for (const hp of event.payload) {
                holidayPrices = holidayPrices.filter(existing => !(existing.roomId === hp.roomId && existing.date === hp.date));
                holidayPrices.push(hp);
              }
              break;
          }
        }
        
        const updatedOrders = orders.map(order => {
          if (order.lockedPrice) return order;
          if (['paid', 'locked', 'checkin', 'checkout', 'completed'].includes(order.status)) return order;
          const room = rooms.find(r => r.id === order.roomId);
          if (!room) return order;
          const newPrice = calculatePrice(room, order.checkinDate, order.checkoutDate, priceVersions, holidayPrices, longStayDiscounts, undefined, order.priceSnapshot.benefitSource, order.priceSnapshot.benefitAmount);
          return {
            ...order,
            priceSnapshot: {
              basePrice: newPrice.basePrice,
              holidayPremium: newPrice.holidayPremium,
              weekendPremium: newPrice.weekendPremium,
              longStayDiscount: newPrice.longStayDiscount,
              otherDiscounts: newPrice.otherDiscounts,
              totalPrice: newPrice.totalPrice,
              benefitSource: newPrice.benefitSource,
              benefitAmount: newPrice.benefitAmount,
            },
          };
        });
        
        set({ properties, rooms, priceVersions, holidayPrices, longStayDiscounts, maintenances, locks, releases, orders: updatedOrders, refunds });
        get().rebuildCalendar();
      },
      
      rebuildCalendar: () => {
        const { rooms, maintenances, locks, releases, orders, calendarStartDate, calendarEndDate, getDailyPrice } = get();
        const calendarStatus = calculateCalendarStatus(rooms, calendarStartDate, calendarEndDate, maintenances, locks, releases, orders, (roomId, date) => getDailyPrice(roomId, date));
        set({ calendarStatus });
      },

      rebuildDerivedData: () => {
        const state = get();
        const explanations = batchExplainAvailability(
          state.rooms, state.calendarStartDate, state.calendarEndDate,
          state.maintenances, state.locks, state.orders, state.channelConfigs,
          state.cleaningSchedules, state.calendarStatus,
          state.orderChannelInfos, state.releases
        );
        const snapshots = calculateAllChannelSnapshots(
          state.rooms, state.calendarStartDate, state.calendarEndDate,
          state.channelConfigs, state.orders, state.orderChannelInfos,
          state.maintenances, state.locks, state.releases
        );
        set({ availabilityExplanations: explanations, channelSnapshots: snapshots });
      },
      
      createProperty: (data) => {
        const property: Property = { ...data, id: generateId('prop_'), createdAt: Date.now() };
        get().applyEvent('PROPERTY_CREATED', property);
        return property;
      },
      
      createRoom: (data) => {
        const room: Room = { ...data, id: generateId('room_'), createdAt: Date.now() };
        get().applyEvent('ROOM_CREATED', room);
        get().initDefaultChannelConfigs(room.id);
        return room;
      },
      
      updateRoom: (id, data) => get().applyEvent('ROOM_UPDATED', { id, data }),
      
      createPriceVersion: (data) => {
        const pv: PriceVersion = { ...data, id: generateId('pv_'), createdAt: Date.now() };
        get().applyEvent('PRICE_VERSION_CREATED', pv);
        return pv;
      },
      
      activatePriceVersion: (id) => {
        get().applyEvent('PRICE_VERSION_ACTIVATED', id);
        return get().recalculateUnlockedOrderPrices();
      },
      
      archivePriceVersion: (id) => get().applyEvent('PRICE_VERSION_ARCHIVED', id),
      
      setHolidayPrice: (data) => {
        const hp: HolidayPrice = { ...data, id: generateId('hp_'), createdAt: Date.now() };
        get().applyEvent('HOLIDAY_PRICE_SET', hp);
        return { holidayPrice: hp, recalcResult: get().recalculateUnlockedOrderPrices() };
      },
      
      setLongStayDiscount: (data) => {
        const discount: LongStayDiscount = { ...data, id: generateId('lsd_'), createdAt: Date.now() };
        get().applyEvent('LONG_STAY_DISCOUNT_SET', discount);
        return { discount, recalcResult: get().recalculateUnlockedOrderPrices() };
      },
      
      batchUpdatePrices: (roomIds, startDate, endDate, adjustment, type) => {
        const state = get();
        const newPrices = calculateBatchPriceUpdate(roomIds, startDate, endDate, adjustment, type, state.holidayPrices, state.rooms, state.priceVersions);
        get().applyEvent('BATCH_PRICE_UPDATED', newPrices);
        return get().recalculateUnlockedOrderPrices();
      },

      protectedBatchUpdatePrices: (roomIds, startDate, endDate, adjustment, type) => {
        const state = get();
        const result = executeProtectedBatchPriceUpdate({
          roomIds, startDate, endDate, priceAdjustment: adjustment, adjustmentType: type,
          existingPrices: state.holidayPrices, orders: state.orders, rooms: state.rooms,
          priceVersions: state.priceVersions, operatorId: state.currentUserId,
        });
        if (result.updatedPrices.length > 0) {
          get().applyEvent('BATCH_PRICE_UPDATED', result.updatedPrices);
          get().recalculateUnlockedOrderPrices();
        }
        get().addDetailedAuditLog({
          entityType: 'HolidayPrice', entityId: `batch_${Date.now()}`, action: 'BATCH_PROTECTED_UPDATE',
          category: 'pricing', oldValue: null, newValue: { adjustment, type, startDate, endDate, roomIds },
          roomId: roomIds[0], changeSummary: formatBatchPriceSummary(result),
          relatedEntityIds: result.skippedOrders.map(o => o.orderId),
        });
        return result;
      },

      validatePriceAdjustmentParams: (adjustment, type, currentAvgPrice) => validatePriceAdjustment(adjustment, type, currentAvgPrice),

      findProtectedOrdersForRange: (roomIds, startDate, endDate) =>
        findProtectedOrders(roomIds, startDate, endDate, get().orders, get().rooms),
      
      createMaintenance: (data) => {
        const maintenance: MaintenanceRecord = { ...data, id: generateId('mt_'), createdAt: Date.now() };
        get().applyEvent('MAINTENANCE_CREATED', maintenance);
        get().addDetailedAuditLog({
          entityType: 'MaintenanceRecord', entityId: maintenance.id, action: 'CREATED', category: 'maintenance',
          oldValue: null, newValue: maintenance, roomId: maintenance.roomId,
          changeSummary: `创建维修工单：${maintenance.reason}（${maintenance.startDate} ~ ${maintenance.endDate}）`,
        });
        get().runExceptionDetection();
        return maintenance;
      },
      
      cancelMaintenance: (id) => {
        const m = get().maintenances.find(x => x.id === id);
        get().applyEvent('MAINTENANCE_CANCELLED', id);
        if (m) get().addDetailedAuditLog({
          entityType: 'MaintenanceRecord', entityId: id, action: 'CANCELLED', category: 'maintenance',
          oldValue: m, newValue: null, roomId: m.roomId, changeSummary: `取消维修工单：${m.reason}`,
        });
      },
      
      createLock: (data) => {
        const lock: LockRecord = { ...data, id: generateId('lock_'), createdAt: Date.now() };
        get().applyEvent('LOCK_CREATED', lock);
        get().addDetailedAuditLog({
          entityType: 'LockRecord', entityId: lock.id, action: 'CREATED', category: 'inventory',
          oldValue: null, newValue: lock, roomId: lock.roomId,
          changeSummary: `锁房：${lock.reason}（${lock.startDate} ~ ${lock.endDate}）`,
        });
        return lock;
      },
      
      releaseLock: (id) => {
        const lock = get().locks.find(l => l.id === id);
        const uid = get().currentUserId;
        get().applyEvent('LOCK_RELEASED', { lockId: id, operatorId: uid });
        if (lock) get().addDetailedAuditLog({
          entityType: 'LockRecord', entityId: id, action: 'RELEASED', category: 'inventory',
          oldValue: lock, newValue: { ...lock, releasedAt: Date.now(), releasedBy: uid }, roomId: lock.roomId,
          changeSummary: `释放锁房：${lock.reason}`,
        });
      },
      
      createRelease: (data) => {
        const release: ReleaseRecord = { ...data, id: generateId('rel_'), createdAt: Date.now() };
        get().applyEvent('RELEASE_CREATED', release);
        get().addDetailedAuditLog({
          entityType: 'ReleaseRecord', entityId: release.id, action: 'CREATED', category: 'inventory',
          oldValue: null, newValue: release, roomId: release.roomId,
          changeSummary: `释放库存：${release.reason}（${release.date}）`,
        });
        return release;
      },
      
      createOrder: (data) => {
        const { channel, channelOrderId, ...orderData } = data;
        const order: Order = {
          ...orderData, id: generateId('order_'), orderNo: generateOrderNo(),
          status: 'pending', lockedPrice: false, createdAt: Date.now(), updatedAt: Date.now(),
        };
        get().applyEvent('ORDER_CREATED', order);
        if (channel) get().assignOrderChannel(order.id, channel);
        get().addDetailedAuditLog({
          entityType: 'Order', entityId: order.id, action: 'CREATED', category: 'order',
          oldValue: null, newValue: order, roomId: order.roomId, orderId: order.id, channel,
          changeSummary: `创建订单 ${order.orderNo}：${order.guestName}，${order.checkinDate} ~ ${order.checkoutDate}，总价 ¥${order.priceSnapshot.totalPrice.toFixed(2)}`,
        });
        get().rebuildDerivedData();
        get().runExceptionDetection();
        return order;
      },
      
      updateOrderStatus: (id, newStatus) => {
        const eventMap: Record<string, EventType> = {
          confirmed: 'ORDER_CONFIRMED', paid: 'ORDER_PAID', locked: 'ORDER_LOCKED',
          checkin: 'ORDER_CHECKIN', checkout: 'ORDER_CHECKOUT', completed: 'ORDER_COMPLETED',
          cancelled: 'ORDER_CANCELLED', partially_cancelled: 'ORDER_PARTIALLY_CANCELLED',
        };
        const eventType = eventMap[newStatus];
        if (eventType) {
          const order = get().orders.find(o => o.id === id);
          get().applyEvent(eventType, { orderId: id, status: newStatus });
          if (order) get().addDetailedAuditLog({
            entityType: 'Order', entityId: id, action: `STATUS_${newStatus.toUpperCase()}`, category: 'order',
            oldValue: { status: order.status }, newValue: { status: newStatus }, roomId: order.roomId, orderId: id,
            changeSummary: `订单 ${order.orderNo} 状态变更：${order.status} → ${newStatus}`,
          });
        }
      },
      
      payOrder: (id, amount) => {
        const order = get().orders.find(o => o.id === id);
        if (order) {
          const updated = { ...order, paidAmount: order.paidAmount + amount, status: 'paid' as const, updatedAt: Date.now() };
          set(s => ({ orders: s.orders.map(o => o.id === id ? updated : o) }));
          get().applyEvent('ORDER_PAID', { orderId: id, status: 'paid', amount });
          get().addDetailedAuditLog({
            entityType: 'Order', entityId: id, action: 'PAID', category: 'order',
            oldValue: { paidAmount: order.paidAmount, status: order.status },
            newValue: { paidAmount: updated.paidAmount, status: 'paid' },
            roomId: order.roomId, orderId: id,
            changeSummary: `订单 ${order.orderNo} 支付 ¥${amount.toFixed(2)}，累计支付 ¥${updated.paidAmount.toFixed(2)}`,
          });
        }
      },
      
      lockOrderPrice: (id) => {
        const order = get().orders.find(o => o.id === id);
        if (order && !order.lockedPrice) {
          const updated = { ...order, lockedPrice: true, status: 'locked' as const, updatedAt: Date.now() };
          set(s => ({ orders: s.orders.map(o => o.id === id ? updated : o) }));
          get().applyEvent('ORDER_LOCKED', { orderId: id, status: 'locked' });
          get().addDetailedAuditLog({
            entityType: 'Order', entityId: id, action: 'PRICE_LOCKED', category: 'order',
            oldValue: { lockedPrice: false, status: order.status },
            newValue: { lockedPrice: true, status: 'locked' }, roomId: order.roomId, orderId: id,
            changeSummary: `订单 ${order.orderNo} 锁价，锁定金额 ¥${order.priceSnapshot.totalPrice.toFixed(2)}`,
          });
        }
      },
      
      cancelOrder: (id, reason) => {
        const { orders, currentUserId } = get();
        const order = orders.find(o => o.id === id);
        if (order) {
          const refundCalc = calculateRefund(order, reason);
          const refund: RefundRecord = {
            id: generateId('refund_'), orderId: id, amount: order.paidAmount, reason,
            daysBeforeCheckin: refundCalc.daysBeforeCheckin, usedBenefits: refundCalc.usedBenefits,
            benefitDeduction: refundCalc.benefitDeduction, cancelFeeRate: refundCalc.cancelFeeRate,
            cancelFee: refundCalc.cancelFee, refundAmount: refundCalc.refundAmount,
            operatorId: currentUserId, createdAt: Date.now(),
          };
          set(s => ({
            orders: s.orders.map(o => o.id === id ? { ...o, status: 'cancelled', updatedAt: Date.now() } : o),
            refunds: [...s.refunds, refund],
          }));
          get().applyEvent('REFUND_CREATED', refund);
          get().applyEvent('ORDER_CANCELLED', { orderId: id, status: 'cancelled' });
          get().addDetailedAuditLog({
            entityType: 'Order', entityId: id, action: 'CANCELLED', category: 'order',
            oldValue: { status: order.status }, newValue: { status: 'cancelled', refundId: refund.id },
            roomId: order.roomId, orderId: id,
            changeSummary: `取消订单 ${order.orderNo}，原因：${reason}，退款 ¥${refund.refundAmount.toFixed(2)}，违约金 ¥${refund.cancelFee.toFixed(2)}`,
          });
          if (refund.refundAmount <= 0 && order.paidAmount > 0) get().runExceptionDetection();
        }
      },
      
      partialCancelOrder: (id, cancelledNights, cancelCheckinDate, cancelCheckoutDate, reason) => {
        const state = get();
        const order = state.orders.find(o => o.id === id);
        const nullResult = {
          validation: { allowed: false, refundAmount: 0, cancelFee: 0, benefitDeduction: 0, remainingNights: 0, cancelledNights: 0, remainingPrice: 0, priceLocked: false, conflicts: ['订单不存在'] },
          success: false,
        };
        if (!order) return nullResult;
        const validation = validatePartialCancel({
          order, cancelCheckinDate, cancelCheckoutDate,
          maintenances: state.maintenances, locks: state.locks, releases: state.releases,
        });
        if (!validation.allowed) return { validation, success: false };
        const totalNights = Math.ceil((new Date(order.checkoutDate).getTime() - new Date(order.checkinDate).getTime()) / (1000 * 60 * 60 * 24));
        const refundCalc = calculatePartialRefund(order, cancelledNights, totalNights, reason);
        const refund: RefundRecord = {
          id: generateId('refund_'), orderId: id, amount: refundCalc.paidAmount, reason,
          daysBeforeCheckin: refundCalc.daysBeforeCheckin, usedBenefits: refundCalc.usedBenefits,
          benefitDeduction: refundCalc.benefitDeduction, cancelFeeRate: refundCalc.cancelFeeRate,
          cancelFee: refundCalc.cancelFee, refundAmount: refundCalc.refundAmount,
          operatorId: state.currentUserId, createdAt: Date.now(),
        };
        set(s => ({
          orders: s.orders.map(o => o.id === id ? { ...o, status: 'partially_cancelled', updatedAt: Date.now() } : o),
          refunds: [...s.refunds, refund],
        }));
        get().applyEvent('REFUND_CREATED', refund);
        get().applyEvent('ORDER_PARTIALLY_CANCELLED', { orderId: id, status: 'partially_cancelled' });
        get().addDetailedAuditLog({
          entityType: 'Order', entityId: id, action: 'PARTIALLY_CANCELLED', category: 'order',
          oldValue: { status: order.status },
          newValue: { status: 'partially_cancelled', refundId: refund.id, cancelledNights },
          roomId: order.roomId, orderId: id,
          changeSummary: `部分取消订单 ${order.orderNo}，取消 ${cancelledNights} 晚（${cancelCheckinDate} ~ ${cancelCheckoutDate}），退款 ¥${refund.refundAmount.toFixed(2)}`,
        });
        get().rebuildDerivedData();
        return { validation, success: true };
      },
      
      rescheduleOrder: (id, newCheckin, newCheckout) => {
        const state = get();
        const order = state.orders.find(o => o.id === id);
        const room = state.rooms.find(r => r.id === order?.roomId);
        const nullVal = {
          validation: { allowed: false, priceChanged: false, oldPrice: 0, newPrice: 0, priceDiff: 0, lockPriceViolation: false, benefitsStillValid: true, expiredBenefits: [], refundRequired: false, refundAmount: 0, additionalPayment: 0, cancellationFees: 0, conflicts: ['订单或房间不存在'], newAvailabilityAvailable: false },
          success: false,
        };
        if (!order || !room) return nullVal;
        const validation = validateReschedule({
          order, room, newCheckinDate: newCheckin, newCheckoutDate: newCheckout,
          priceVersions: state.priceVersions, holidayPrices: state.holidayPrices,
          longStayDiscounts: state.longStayDiscounts, calendarStatus: state.calendarStatus,
          maintenances: state.maintenances, locks: state.locks, releases: state.releases, allOrders: state.orders,
        });
        if (!validation.allowed) return { validation, success: false };
        get().applyEvent('ORDER_RESCHEDULED', { orderId: id, newCheckin, newCheckout });
        get().addDetailedAuditLog({
          entityType: 'Order', entityId: id, action: 'RESCHEDULED', category: 'order',
          oldValue: { checkinDate: order.checkinDate, checkoutDate: order.checkoutDate },
          newValue: { checkinDate: newCheckin, checkoutDate: newCheckout, rescheduledFrom: order.id },
          roomId: order.roomId, orderId: id,
          changeSummary: `改期订单 ${order.orderNo}：${order.checkinDate}~${order.checkoutDate} → ${newCheckin}~${newCheckout}，差额 ¥${validation.priceDiff.toFixed(2)}${validation.expiredBenefits.length > 0 ? `，优惠失效：${validation.expiredBenefits.join('、')}` : ''}`,
          relatedEntityIds: validation.expiredBenefits.length > 0 ? validation.expiredBenefits : undefined,
        });
        get().rebuildDerivedData();
        return { validation, success: true };
      },

      validateOrderReschedule: (orderId, newCheckin, newCheckout) => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        const room = state.rooms.find(r => r.id === order?.roomId);
        if (!order || !room) return null;
        return validateReschedule({
          order, room, newCheckinDate: newCheckin, newCheckoutDate: newCheckout,
          priceVersions: state.priceVersions, holidayPrices: state.holidayPrices,
          longStayDiscounts: state.longStayDiscounts, calendarStatus: state.calendarStatus,
          maintenances: state.maintenances, locks: state.locks, releases: state.releases, allOrders: state.orders,
        });
      },

      validateOrderPartialCancel: (orderId, cancelCheckin, cancelCheckout) => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return null;
        return validatePartialCancel({
          order, cancelCheckinDate: cancelCheckin, cancelCheckoutDate: cancelCheckout,
          maintenances: state.maintenances, locks: state.locks, releases: state.releases,
        });
      },
      
      calculatePriceForBooking: (roomId, checkin, checkout, existingOrderId) => {
        const { rooms, priceVersions, holidayPrices, longStayDiscounts, orders } = get();
        const room = rooms.find(r => r.id === roomId);
        if (!room) return null;
        const existingOrder = existingOrderId ? orders.find(o => o.id === existingOrderId) : null;
        return calculatePrice(room, checkin, checkout, priceVersions, holidayPrices, longStayDiscounts, existingOrder);
      },
      
      calculateRefundForOrder: (orderId, reason) => {
        const order = get().orders.find(o => o.id === orderId);
        if (!order) return null;
        return calculateRefund(order, reason);
      },
      
      getDynamicOrderPrice: (orderId) => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        if (!order) throw new Error('订单不存在');
        const room = state.rooms.find(r => r.id === order.roomId);
        if (!room) throw new Error('房间不存在');
        const isLocked = order.lockedPrice || ['paid', 'locked', 'checkin', 'checkout', 'completed'].includes(order.status);
        const snapshotSubtotal = order.priceSnapshot.basePrice + order.priceSnapshot.holidayPremium + order.priceSnapshot.weekendPremium;
        const snapshotPrice: PriceCalculationResult = {
          basePrice: order.priceSnapshot.basePrice, holidayPremium: order.priceSnapshot.holidayPremium,
          weekendPremium: order.priceSnapshot.weekendPremium, longStayDiscount: order.priceSnapshot.longStayDiscount,
          otherDiscounts: order.priceSnapshot.otherDiscounts, subtotal: snapshotSubtotal,
          benefitSource: order.priceSnapshot.benefitSource, benefitAmount: order.priceSnapshot.benefitAmount,
          totalPrice: order.priceSnapshot.totalPrice, dailyBreakdown: [],
        };
        const currentPrice = isLocked ? snapshotPrice : calculatePrice(
          room, order.checkinDate, order.checkoutDate, state.priceVersions, state.holidayPrices,
          state.longStayDiscounts, null, order.priceSnapshot.benefitSource, order.priceSnapshot.benefitAmount
        );
        const priceChanged = !isLocked && Math.abs(currentPrice.totalPrice - snapshotPrice.totalPrice) > 0.01;
        return { currentPrice, snapshotPrice, isLocked, priceChanged };
      },
      
      recalculateUnlockedOrderPrices: () => {
        const state = get();
        const affectedOrders: Array<{ orderId: string; orderNo: string; guestName: string; oldPrice: number; newPrice: number }> = [];
        for (const order of state.orders) {
          const isLocked = order.lockedPrice || ['paid', 'locked', 'checkin', 'checkout', 'completed'].includes(order.status);
          if (isLocked) continue;
          const room = state.rooms.find(r => r.id === order.roomId);
          if (!room) continue;
          const oldPrice = order.priceSnapshot.totalPrice;
          const newCalc = calculatePrice(room, order.checkinDate, order.checkoutDate, state.priceVersions, state.holidayPrices, state.longStayDiscounts, null, order.priceSnapshot.benefitSource, order.priceSnapshot.benefitAmount);
          if (Math.abs(newCalc.totalPrice - oldPrice) > 0.01) {
            state.applyEvent('ORDER_PRICE_RECALCULATED', {
              orderId: order.id, oldPrice, newPrice: newCalc.totalPrice,
              oldSnapshot: order.priceSnapshot,
              newSnapshot: {
                basePrice: newCalc.basePrice, holidayPremium: newCalc.holidayPremium, weekendPremium: newCalc.weekendPremium,
                longStayDiscount: newCalc.longStayDiscount, otherDiscounts: newCalc.otherDiscounts,
                totalPrice: newCalc.totalPrice, benefitSource: newCalc.benefitSource, benefitAmount: newCalc.benefitAmount,
              },
            });
            affectedOrders.push({ orderId: order.id, orderNo: order.orderNo, guestName: order.guestName, oldPrice, newPrice: newCalc.totalPrice });
          }
        }
        return { updatedCount: affectedOrders.length, affectedOrders };
      },
      
      getAvailability: (roomId, checkin, checkout) =>
        checkAvailability(roomId, checkin, checkout, get().calendarStatus),
      
      getConflicts: () => getAllConflicts(get().calendarStatus),
      
      getRevenueForecast: (startDate, endDate) => {
        const { rooms, orders, calendarStatus } = get();
        return calculateRevenueForecast(rooms, orders, startDate, endDate,
          (roomId, date) => calendarStatus.get(`${roomId}_${date}`));
      },
      
      getDailyPrice: (roomId, date) => {
        const { rooms, priceVersions, holidayPrices } = get();
        const room = rooms.find(r => r.id === roomId);
        if (!room) return { price: 0, basePrice: 0, isHoliday: false, isWeekend: false };
        const result = calculateDailyPrice(room, date, priceVersions, holidayPrices);
        return { price: result.finalPrice, basePrice: result.basePrice, isHoliday: isHoliday(date), isWeekend: isWeekend(date) };
      },

      getAvailabilityExplanation: (roomId, date) => {
        const state = get();
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) return null;
        const key = `${roomId}_${date}`;
        const cached = state.availabilityExplanations.get(key);
        if (cached) return cached;
        const dayStatus = state.calendarStatus.get(key);
        return explainAvailability(room, date, state.maintenances, state.locks, state.orders, state.channelConfigs, state.cleaningSchedules, dayStatus);
      },

      getAllAvailabilityExplanations: () => get().availabilityExplanations,

      formatSaleStatus: (status) => ({ text: formatSaleStatusText(status), color: getSaleStatusColor(status) }),

      createOrUpdateChannelConfig: (roomId, channel, config) => {
        const state = get();
        const existing = state.channelConfigs.find(c => c.roomId === roomId && c.channel === channel);
        const now = Date.now();
        const updated: ChannelConfig = existing
          ? { ...existing, ...config, updatedAt: now }
          : createDefaultChannelConfig(roomId, channel);
        set(s => ({
          channelConfigs: [...s.channelConfigs.filter(c => !(c.roomId === roomId && c.channel === channel)), updated],
        }));
        get().addDetailedAuditLog({
          entityType: 'ChannelConfig', entityId: updated.id, action: existing ? 'UPDATED' : 'CREATED', category: 'channel',
          oldValue: existing || null, newValue: updated, roomId, channel,
          changeSummary: `${existing ? '更新' : '创建'}渠道配置：${channel}，库存 ${updated.totalInventory}，预留 ${updated.reservedInventory}，佣金率 ${(updated.commissionRate * 100).toFixed(0)}%`,
        });
        get().rebuildDerivedData();
        return updated;
      },

      initDefaultChannelConfigs: (roomId) => {
        const channels: ChannelType[] = ['direct', 'ota', 'corporate_longstay', 'event_buyout'];
        return channels.map(ch => get().createOrUpdateChannelConfig(roomId, ch, {}));
      },

      getAllChannelSnapshots: () => get().channelSnapshots,

      getChannelSnapshotsAt: (roomId, date) => {
        const map = get().channelSnapshots;
        const channels: ChannelType[] = ['direct', 'ota', 'corporate_longstay', 'event_buyout'];
        return channels.map(ch => map.get(`${roomId}_${date}_${ch}`)).filter(Boolean) as ChannelInventorySnapshot[];
      },

      checkChannelOversellForRoom: (roomId, date) => {
        const snapshots = Array.from(get().channelSnapshots.values()).filter(s => s.roomId === roomId && s.date === date);
        const oversold = snapshots.find(s => s.oversoldUnits > 0);
        return { hasOversell: !!oversold, oversoldUnits: oversold?.oversoldUnits || 0, channel: oversold?.channel };
      },

      assignOrderChannel: (orderId, channel, channelOrderIdOrCommission, commissionAmount) => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        const channelConfig = state.channelConfigs.find(c => c.roomId === order?.roomId && c.channel === channel);
        
        let channelOrderId: string | undefined;
        let finalCommission: number;
        
        if (typeof channelOrderIdOrCommission === 'string') {
          channelOrderId = channelOrderIdOrCommission;
          if (typeof commissionAmount === 'number') {
            finalCommission = commissionAmount;
          } else {
            const rate = channelConfig?.commissionRate ?? 0;
            finalCommission = order ? (order.priceSnapshot.totalPrice * rate) : 0;
          }
        } else if (typeof channelOrderIdOrCommission === 'number') {
          const rate = channelOrderIdOrCommission;
          finalCommission = order ? (order.priceSnapshot.totalPrice * rate) : 0;
        } else {
          const rate = channelConfig?.commissionRate ?? 0;
          finalCommission = order ? (order.priceSnapshot.totalPrice * rate) : 0;
        }
        
        const info: OrderChannelInfo = {
          orderId, channel,
          channelOrderId,
          commissionAmount: finalCommission,
        };
        set(s => ({ orderChannelInfos: [...s.orderChannelInfos.filter(i => i.orderId !== orderId), info] }));
        get().addDetailedAuditLog({
          entityType: 'OrderChannelInfo', entityId: orderId, action: 'ASSIGNED', category: 'channel',
          oldValue: null, newValue: info, roomId: order?.roomId, orderId, channel,
          changeSummary: `订单 ${order?.orderNo || orderId} 分配渠道：${channel}${channelOrderId ? `（单号：${channelOrderId}）` : ''}，佣金 ¥${finalCommission.toFixed(2)}`,
        });
        get().rebuildDerivedData();
      },

      getOrderChannel: (orderId) => get().orderChannelInfos.find(i => i.orderId === orderId) || null,

      generatePricingSuggestions: (roomIds, startDate, endDate) => {
        const state = get();
        const suggestions = generateBulkPricingSuggestions(
          state.rooms.filter(r => roomIds.includes(r.id)), startDate, endDate,
          state.priceVersions, state.holidayPrices, state.maintenances,
          state.cleaningSchedules, state.historicalOccupancies
        );
        set(s => ({ pricingSuggestions: [...s.pricingSuggestions, ...suggestions] }));
        get().addDetailedAuditLog({
          entityType: 'PricingSuggestion', entityId: `bulk_${Date.now()}`, action: 'GENERATED', category: 'pricing',
          oldValue: null, newValue: { count: suggestions.length, roomIds, startDate, endDate },
          changeSummary: `生成 ${suggestions.length} 条调价建议，涉及 ${roomIds.length} 个房间，日期范围 ${startDate} ~ ${endDate}`,
        });
        return suggestions;
      },

      applySinglePricingSuggestion: (suggestionId) => {
        const state = get();
        const suggestion = state.pricingSuggestions.find(s => s.id === suggestionId);
        if (!suggestion || suggestion.status !== 'pending') return { success: false };
        const applied = applyPricingSuggestion(suggestion, state.currentUserId);
        if (applied) {
          const fullHolidayPrice: HolidayPrice = {
            ...applied.holidayPrice,
            id: `hp_${suggestion.roomId}_${suggestion.date}_${Date.now()}`,
            createdAt: Date.now(),
          };
          get().applyEvent('HOLIDAY_PRICE_SET', fullHolidayPrice);
          set(s => ({
            pricingSuggestions: s.pricingSuggestions.map(s2 =>
              s2.id === suggestionId ? { ...s2, status: 'applied' as const, appliedAt: Date.now(), appliedBy: s.currentUserId } : s2
            ),
          }));
          get().addDetailedAuditLog({
            entityType: 'PricingSuggestion', entityId: suggestionId, action: 'APPLIED', category: 'pricing',
            oldValue: suggestion, newValue: { status: 'applied', holidayPrice: fullHolidayPrice }, roomId: suggestion.roomId,
            changeSummary: `应用调价建议：${suggestion.suggestionType}，${suggestion.currentPrice.toFixed(0)} → ${suggestion.suggestedPrice.toFixed(0)}（${(suggestion.adjustmentPercent > 0 ? '+' : '')}${suggestion.adjustmentPercent.toFixed(1)}%），置信度 ${(suggestion.confidenceScore * 100).toFixed(0)}%`,
          });
          get().recalculateUnlockedOrderPrices();
          return { success: true, holidayPrice: fullHolidayPrice };
        }
        return { success: false };
      },

      rejectPricingSuggestion: (suggestionId) => {
        const suggestion = get().pricingSuggestions.find(s => s.id === suggestionId);
        if (!suggestion) return;
        set(s => ({
          pricingSuggestions: s.pricingSuggestions.map(s2 => s2.id === suggestionId ? { ...s2, status: 'rejected' as const } : s2),
        }));
        get().addDetailedAuditLog({
          entityType: 'PricingSuggestion', entityId: suggestionId, action: 'REJECTED', category: 'pricing',
          oldValue: suggestion, newValue: { status: 'rejected' }, roomId: suggestion.roomId,
          changeSummary: `拒绝调价建议：${suggestion.suggestionType}，理由：运营人员手动否决`,
        });
      },

      getPricingSuggestions: (roomId) => {
        const state = get();
        return roomId ? state.pricingSuggestions.filter(s => s.roomId === roomId) : state.pricingSuggestions;
      },

      runExceptionDetection: () => {
        const state = get();
        const today = getToday();
        const detected = runAllExceptionDetectors({
          snapshots: Array.from(state.channelSnapshots.values()),
          maintenances: state.maintenances, cleaningSchedules: state.cleaningSchedules,
          refunds: state.refunds, orders: state.orders, today,
          operatorId: state.currentUserId, operatorRole: state.currentRole,
        });
        if (detected.length === 0) return [];
        const existingIds = new Set(state.exceptionQueue.map(e => `${e.type}_${e.roomId}_${e.orderId}_${e.date}`));
        const newItems = detected.filter(d => !existingIds.has(`${d.type}_${d.roomId}_${d.orderId}_${d.date}`));
        if (newItems.length > 0) {
          set(s => ({ exceptionQueue: [...s.exceptionQueue, ...newItems] }));
          get().addDetailedAuditLog({
            entityType: 'ExceptionQueue', entityId: `detection_${Date.now()}`, action: 'DETECTED', category: 'exception',
            oldValue: null, newValue: { count: newItems.length, types: newItems.map(i => i.type) },
            changeSummary: `异常检测发现 ${newItems.length} 个新异常：${newItems.map(i => i.title).join('；')}`,
          });
        }
        return newItems;
      },

      updateException: (exceptionId, status, operatorId, operatorRole, note) => {
        const state = get();
        const exception = state.exceptionQueue.find(e => e.id === exceptionId);
        if (!exception) return null;
        const opId = operatorId || state.currentUserId;
        const opRole = operatorRole || state.currentRole;
        const updated = updateExceptionStatus(exception, status, opId, opRole, note);
        set(s => ({ exceptionQueue: s.exceptionQueue.map(e => e.id === exceptionId ? updated : e) }));
        return updated;
      },

      assignExceptionTo: (exceptionId, assigneeId, operatorId, operatorRole, note) => {
        const state = get();
        const exception = state.exceptionQueue.find(e => e.id === exceptionId);
        if (!exception) return null;
        const opId = operatorId || state.currentUserId;
        const opRole = operatorRole || state.currentRole;
        const updated = assignException(exception, assigneeId, opId, opRole, note);
        set(s => ({ exceptionQueue: s.exceptionQueue.map(e => e.id === exceptionId ? updated : e) }));
        return updated;
      },

      getExceptionQueue: (filters) => filters ? filterExceptions(get().exceptionQueue, filters) : get().exceptionQueue,

      getExceptionStatsSummary: () => getExceptionStats(get().exceptionQueue),

      getExceptionsByType: (type) => get().exceptionQueue.filter(e => e.type === type),

      addDetailedAuditLog: (params) => {
        const state = get();
        const log = createDetailedAuditLog({ ...params, operatorId: state.currentUserId, operatorRole: state.currentRole });
        set(s => ({ detailedAuditLogs: [log, ...s.detailedAuditLogs] }));
        return log;
      },

      getDetailedAuditLogs: (limitOrFilters = {}) => {
        const state = get();
        let filtered = state.detailedAuditLogs;
        if (typeof limitOrFilters === 'object') {
          const filters = limitOrFilters;
          filtered = filtered.filter(log => {
            if (filters.category && log.category !== filters.category) return false;
            if (filters.roomId && log.roomId !== filters.roomId) return false;
            if (filters.orderId && log.orderId !== filters.orderId) return false;
            return true;
          });
        }
        if (typeof limitOrFilters === 'number') return filtered.slice(0, limitOrFilters);
        return filtered;
      },

      generateHistoricalData: (roomIdsOrDays, daysBackParam) => {
        const state = get();
        let roomIds: string[];
        let daysBack: number;
        if (typeof roomIdsOrDays === 'number') {
          roomIds = state.rooms.map(r => r.id);
          daysBack = roomIdsOrDays;
        } else {
          roomIds = roomIdsOrDays;
          daysBack = daysBackParam ?? 30;
        }
        const records = generateHistoricalOccupancyData(state.rooms.filter(r => roomIds.includes(r.id)), daysBack);
        set(s => ({ historicalOccupancies: [...s.historicalOccupancies, ...records] }));
        get().addDetailedAuditLog({
          entityType: 'HistoricalOccupancy', entityId: `gen_${Date.now()}`, action: 'GENERATED', category: 'system',
          oldValue: null, newValue: { count: records.length, roomIds, daysBack },
          changeSummary: `生成 ${records.length} 条历史入住率数据，回溯 ${daysBack} 天，共 ${roomIds.length} 间房`,
        });
        return records;
      },

      generateCleaningSchedulesForRange: (startDate, endDate) => {
        const state = get();
        const schedules = generateCleaningSchedule(state.rooms, startDate, endDate);
        const existingKeys = new Set(state.cleaningSchedules.map(s => `${s.roomId}_${s.date}`));
        const newSchedules = schedules.filter(s => !existingKeys.has(`${s.roomId}_${s.date}`));
        if (newSchedules.length > 0) {
          set(s => ({ cleaningSchedules: [...s.cleaningSchedules, ...newSchedules] }));
          get().addDetailedAuditLog({
            entityType: 'CleaningSchedule', entityId: `gen_${Date.now()}`, action: 'GENERATED', category: 'inventory',
            oldValue: null, newValue: { count: newSchedules.length, startDate, endDate },
            changeSummary: `生成 ${newSchedules.length} 条清洁排期（${startDate} ~ ${endDate}）`,
          });
        }
        get().rebuildDerivedData();
        return schedules;
      },

      updateCleaningStatus: (scheduleId, status, notes) => {
        const state = get();
        const schedule = state.cleaningSchedules.find(s => s.id === scheduleId);
        if (!schedule) return null;
        const updated: CleaningSchedule = {
          ...schedule, status, notes: notes || schedule.notes,
          completedAt: status === 'completed' ? Date.now() : schedule.completedAt,
        };
        set(s => ({ cleaningSchedules: s.cleaningSchedules.map(s2 => s2.id === scheduleId ? updated : s2) }));
        get().addDetailedAuditLog({
          entityType: 'CleaningSchedule', entityId: scheduleId, action: `STATUS_${status.toUpperCase()}`, category: 'inventory',
          oldValue: schedule, newValue: updated, roomId: schedule.roomId,
          changeSummary: `清洁排期状态变更：${schedule.status} → ${status}${notes ? `，备注：${notes}` : ''}`,
        });
        get().rebuildDerivedData();
        if (status === 'failed') get().runExceptionDetection();
        return updated;
      },
      
      importCalendar: (data) => {
        const { applyEvent, resetAllData } = get();
        if (!data) throw new Error('导入数据为空');
        if (data.rooms && Array.isArray(data.rooms)) {
          for (const room of data.rooms) applyEvent('ROOM_CREATED', {
            id: room.id, propertyId: room.propertyId, name: room.name, roomNumber: room.roomNumber,
            basePrice: room.basePrice, maxGuests: room.maxGuests, bedCount: room.bedCount,
            area: room.area, amenities: room.amenities || [], createdAt: room.createdAt || Date.now(),
          });
        }
        if (data.holidayPrices && Array.isArray(data.holidayPrices)) {
          for (const hp of data.holidayPrices) applyEvent('HOLIDAY_PRICE_SET', {
            id: hp.id, roomId: hp.roomId, date: hp.date, price: hp.price,
            reason: hp.reason || '导入', createdAt: hp.createdAt || Date.now(),
          });
        }
        if (data.maintenances && Array.isArray(data.maintenances)) {
          for (const mt of data.maintenances) applyEvent('MAINTENANCE_CREATED', {
            id: mt.id, roomId: mt.roomId, startDate: mt.startDate, endDate: mt.endDate,
            type: mt.type, reason: mt.reason || '导入', operatorId: mt.operatorId || 'system',
            createdAt: mt.createdAt || Date.now(),
          });
        }
        if (data.locks && Array.isArray(data.locks)) {
          for (const lock of data.locks) {
            applyEvent('LOCK_CREATED', {
              id: lock.id, roomId: lock.roomId, startDate: lock.startDate, endDate: lock.endDate,
              reason: lock.reason || '导入', lockedBy: lock.lockedBy || 'system',
              createdAt: lock.createdAt || Date.now(), releasedAt: lock.releasedAt, releasedBy: lock.releasedBy,
            });
            if (lock.releasedAt) applyEvent('LOCK_RELEASED', { lockId: lock.id, operatorId: lock.releasedBy || 'system' });
          }
        }
        if (data.orders && Array.isArray(data.orders)) {
          for (const order of data.orders) {
            applyEvent('ORDER_CREATED', {
              id: order.id, orderNo: order.orderNo, roomId: order.roomId, guestId: order.guestId,
              guestName: order.guestName, guestPhone: order.guestPhone, checkinDate: order.checkinDate,
              checkoutDate: order.checkoutDate, guestCount: order.guestCount, priceSnapshot: order.priceSnapshot,
              paidAmount: order.paidAmount, status: 'pending', lockedPrice: order.lockedPrice,
              createdAt: order.createdAt || Date.now(), updatedAt: order.updatedAt || Date.now(),
            });
            if (order.status !== 'pending') {
              const map: Record<string, EventType> = {
                confirmed: 'ORDER_CONFIRMED', paid: 'ORDER_PAID', locked: 'ORDER_LOCKED',
                checkin: 'ORDER_CHECKIN', checkout: 'ORDER_CHECKOUT', completed: 'ORDER_COMPLETED',
                cancelled: 'ORDER_CANCELLED', partially_cancelled: 'ORDER_PARTIALLY_CANCELLED',
              };
              if (map[order.status]) applyEvent(map[order.status], { orderId: order.id, status: order.status });
            }
          }
        }
        if (data.priceVersions && Array.isArray(data.priceVersions)) {
          for (const pv of data.priceVersions) {
            applyEvent('PRICE_VERSION_CREATED', {
              id: pv.id, roomId: pv.roomId, name: pv.name, startDate: pv.startDate, endDate: pv.endDate,
              basePrice: pv.basePrice, weekendPremium: pv.weekendPremium, holidayPremium: pv.holidayPremium,
              status: 'draft', createdAt: pv.createdAt || Date.now(), createdBy: pv.createdBy || 'system',
            });
            if (pv.status === 'active') applyEvent('PRICE_VERSION_ACTIVATED', pv.id);
            else if (pv.status === 'archived') applyEvent('PRICE_VERSION_ARCHIVED', pv.id);
          }
        }
        if (data.properties && Array.isArray(data.properties)) {
          for (const prop of data.properties) applyEvent('PROPERTY_CREATED', {
            id: prop.id, name: prop.name, address: prop.address, description: prop.description,
            hostId: prop.hostId, createdAt: prop.createdAt || Date.now(),
          });
        }
      },
      
      exportCalendar: () => {
        const state = get();
        const exportRooms = state.selectedRoomIds.length > 0 ? state.selectedRoomIds : state.rooms.map(r => r.id);
        return JSON.stringify({
          exportDate: new Date().toISOString(),
          rooms: state.rooms.filter(r => exportRooms.includes(r.id)),
          calendarData: Array.from(state.calendarStatus.entries())
            .filter(([k]) => exportRooms.some(rid => k.startsWith(rid + '_')))
            .map(([k, v]) => ({ key: k, ...v })),
          holidayPrices: state.holidayPrices.filter(hp => exportRooms.includes(hp.roomId)),
          maintenances: state.maintenances.filter(m => exportRooms.includes(m.roomId)),
          locks: state.locks.filter(l => exportRooms.includes(l.roomId)),
          orders: state.orders.filter(o => exportRooms.includes(o.roomId)),
          channelConfigs: state.channelConfigs.filter(c => exportRooms.includes(c.roomId)),
          pricingSuggestions: state.pricingSuggestions.filter(p => exportRooms.includes(p.roomId)),
          exceptionQueue: state.exceptionQueue,
          detailedAuditLogs: state.detailedAuditLogs.slice(0, 500),
        }, null, 2);
      },
      
      resetAllData: () => {
        set({
          events: [], currentRole: 'host', currentUserId: 'user_1', currentPropertyId: null,
          properties: [], rooms: [], priceVersions: [], holidayPrices: [], longStayDiscounts: [],
          maintenances: [], locks: [], releases: [], orders: [], refunds: [], auditLogs: [],
          channelConfigs: [], orderChannelInfos: [], pricingSuggestions: [], exceptionQueue: [],
          detailedAuditLogs: [], cleaningSchedules: [], historicalOccupancies: [],
          calendarStatus: new Map(), availabilityExplanations: new Map(), channelSnapshots: new Map(),
          selectedRoomIds: [], selectedDate: null, selectedOrderId: null,
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
        channelConfigs: state.channelConfigs,
        orderChannelInfos: state.orderChannelInfos,
        pricingSuggestions: state.pricingSuggestions,
        exceptionQueue: state.exceptionQueue,
        detailedAuditLogs: state.detailedAuditLogs,
        cleaningSchedules: state.cleaningSchedules,
        historicalOccupancies: state.historicalOccupancies,
        calendarStartDate: state.calendarStartDate,
        calendarEndDate: state.calendarEndDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.replayEvents();
          state.rebuildDerivedData();
        }
      },
    }
  )
);
