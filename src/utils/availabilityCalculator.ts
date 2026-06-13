import type { 
  Room, MaintenanceRecord, LockRecord, ReleaseRecord, Order, 
  CalendarDayStatus, ConflictInfo, MaintenanceType 
} from '../types';
import { getDatesBetween, isDateInRange, getToday } from './dateUtils';

const getMaintenanceTypeForDate = (
  roomId: string,
  date: string,
  maintenances: MaintenanceRecord[]
): MaintenanceType | null => {
  const maintenance = maintenances.find(
    m => m.roomId === roomId && isDateInRange(date, m.startDate, m.endDate)
  );
  return maintenance?.type || null;
};

const isLocked = (
  roomId: string,
  date: string,
  locks: LockRecord[]
): boolean => {
  return locks.some(
    l => l.roomId === roomId && 
         isDateInRange(date, l.startDate, l.endDate) && 
         !l.releasedAt
  );
};

const isReleased = (
  roomId: string,
  date: string,
  releases: ReleaseRecord[]
): boolean => {
  return releases.some(r => r.roomId === roomId && r.date === date);
};

const getOrdersForDate = (
  roomId: string,
  date: string,
  orders: Order[]
): Order[] => {
  return orders.filter(
    o => o.roomId === roomId && 
         isDateInRange(date, o.checkinDate, o.checkoutDate) &&
         !['cancelled', 'partially_cancelled'].includes(o.status)
  );
};

const getConflicts = (
  roomId: string,
  date: string,
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  orders: Order[]
): ConflictInfo[] => {
  const conflicts: ConflictInfo[] = [];
  const activeOrders = getOrdersForDate(roomId, date, orders);
  const maintenanceType = getMaintenanceTypeForDate(roomId, date, maintenances);
  const locked = isLocked(roomId, date, locks);

  if (maintenanceType && activeOrders.length > 0) {
    conflicts.push({
      type: 'maintenance_order',
      severity: 'error',
      message: `维修日期与订单冲突（${activeOrders.length}个订单）`,
      entityIds: [
        ...maintenances.filter(m => m.roomId === roomId && isDateInRange(date, m.startDate, m.endDate)).map(m => m.id),
        ...activeOrders.map(o => o.id)
      ]
    });
  }

  if (locked && activeOrders.length > 0) {
    conflicts.push({
      type: 'lock_order',
      severity: 'warning',
      message: `锁房日期与订单冲突（${activeOrders.length}个订单）`,
      entityIds: [
        ...locks.filter(l => l.roomId === roomId && isDateInRange(date, l.startDate, l.endDate) && !l.releasedAt).map(l => l.id),
        ...activeOrders.map(o => o.id)
      ]
    });
  }

  if (activeOrders.length > 1) {
    conflicts.push({
      type: 'order_overlap',
      severity: 'error',
      message: `订单重叠（${activeOrders.length}个订单）`,
      entityIds: activeOrders.map(o => o.id)
    });
  }

  return conflicts;
};

export const calculateDayStatus = (
  room: Room,
  date: string,
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  releases: ReleaseRecord[],
  orders: Order[],
  dailyPrice: number,
  basePrice: number,
  isHoliday: boolean,
  isWeekend: boolean
): CalendarDayStatus => {
  const maintenanceType = getMaintenanceTypeForDate(room.id, date, maintenances);
  const locked = isLocked(room.id, date, locks);
  const released = isReleased(room.id, date, releases);
  const activeOrders = getOrdersForDate(room.id, date, orders);
  const conflicts = getConflicts(room.id, date, maintenances, locks, orders);

  let available = true;
  let availableUnits = 1;

  if (maintenanceType === 'full_day') {
    available = false;
    availableUnits = 0;
  } else if (maintenanceType === 'half_day_morning' || maintenanceType === 'half_day_afternoon') {
    available = true;
    availableUnits = 0.5;
  }

  if (locked && !released) {
    available = false;
    availableUnits = 0;
  }

  if (activeOrders.length >= 1) {
    available = false;
    availableUnits = 0;
  }

  return {
    date,
    roomId: room.id,
    available,
    availableUnits,
    price: dailyPrice,
    basePrice,
    isHoliday,
    isWeekend,
    maintenanceType,
    isLocked: locked,
    isReleased: released,
    orderIds: activeOrders.map(o => o.id),
    conflicts
  };
};

export const calculateCalendarStatus = (
  rooms: Room[],
  startDate: string,
  endDate: string,
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  releases: ReleaseRecord[],
  orders: Order[],
  getDailyPrice: (roomId: string, date: string) => { price: number; basePrice: number; isHoliday: boolean; isWeekend: boolean }
): Map<string, CalendarDayStatus> => {
  const statusMap = new Map<string, CalendarDayStatus>();
  const dates = getDatesBetween(startDate, endDate);

  for (const room of rooms) {
    for (const date of dates) {
      const { price, basePrice, isHoliday, isWeekend } = getDailyPrice(room.id, date);
      const status = calculateDayStatus(
        room,
        date,
        maintenances,
        locks,
        releases,
        orders,
        price,
        basePrice,
        isHoliday,
        isWeekend
      );
      statusMap.set(`${room.id}_${date}`, status);
    }
  }

  return statusMap;
};

export const checkAvailability = (
  roomId: string,
  checkinDate: string,
  checkoutDate: string,
  calendarStatus: Map<string, CalendarDayStatus>
): { available: boolean; conflicts: string[]; availableDates: string[]; unavailableDates: string[] } => {
  const dates = getDatesBetween(checkinDate, checkoutDate);
  const availableDates: string[] = [];
  const unavailableDates: string[] = [];
  const conflicts: string[] = [];

  for (const date of dates) {
    const status = calendarStatus.get(`${roomId}_${date}`);
    if (status && status.available) {
      availableDates.push(date);
    } else {
      unavailableDates.push(date);
      if (status) {
        if (status.maintenanceType === 'full_day') {
          conflicts.push(`${date}：全天维修`);
        } else if (status.maintenanceType) {
          conflicts.push(`${date}：半日维修`);
        }
        if (status.isLocked && !status.isReleased) {
          conflicts.push(`${date}：已锁房`);
        }
        if (status.orderIds.length > 0) {
          conflicts.push(`${date}：已有订单`);
        }
      }
    }
  }

  return {
    available: unavailableDates.length === 0,
    conflicts,
    availableDates,
    unavailableDates
  };
};

export const getAllConflicts = (
  calendarStatus: Map<string, CalendarDayStatus>
): ConflictInfo[] => {
  const allConflicts: ConflictInfo[] = [];
  for (const status of calendarStatus.values()) {
    if (status.conflicts.length > 0) {
      allConflicts.push(...status.conflicts);
    }
  }
  return allConflicts;
};

export const checkCrossNightOrder = (
  checkinDate: string,
  checkoutDate: string
): boolean => {
  return checkinDate !== checkoutDate;
};
