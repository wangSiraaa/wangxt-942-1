import type {
  Room,
  MaintenanceRecord,
  LockRecord,
  Order,
  ChannelConfig,
  ChannelInventorySnapshot,
  CleaningSchedule,
  AvailabilityExplanation,
  SaleStatus,
  CalendarDayStatus,
} from '../types';
import { isDateInRange, getToday } from './dateUtils';
import { calculateAllChannelSnapshots } from './channelInventory';

const getActiveOrdersForDate = (
  roomId: string,
  date: string,
  orders: Order[]
): Order[] => {
  return orders.filter(
    (o) =>
      o.roomId === roomId &&
      isDateInRange(date, o.checkinDate, o.checkoutDate) &&
      !['cancelled', 'partially_cancelled'].includes(o.status)
  );
};

const getMaintenanceForDate = (
  roomId: string,
  date: string,
  maintenances: MaintenanceRecord[]
): MaintenanceRecord[] => {
  return maintenances.filter(
    (m) => m.roomId === roomId && isDateInRange(date, m.startDate, m.endDate)
  );
};

const getLocksForDate = (
  roomId: string,
  date: string,
  locks: LockRecord[]
): LockRecord[] => {
  return locks.filter(
    (l) =>
      l.roomId === roomId &&
      isDateInRange(date, l.startDate, l.endDate) &&
      !l.releasedAt
  );
};

const getCleaningStatus = (
  roomId: string,
  date: string,
  cleaningSchedules: CleaningSchedule[]
): CleaningSchedule | null => {
  const schedule = cleaningSchedules.find(
    (c) => c.roomId === roomId && c.date === date
  );
  return schedule || null;
};

const getTotalInventory = (
  roomId: string,
  channelConfigs: ChannelConfig[]
): number => {
  const configs = channelConfigs.filter(
    (c) => c.roomId === roomId && c.enabled
  );
  if (configs.length === 0) return 1;
  return Math.max(...configs.map((c) => c.totalInventory), 1);
};

const getSoldInventory = (
  snapshots: ChannelInventorySnapshot[]
): number => {
  return snapshots.reduce((sum, s) => sum + s.soldUnits, 0);
};

const hasOversellRisk = (
  snapshots: ChannelInventorySnapshot[]
): boolean => {
  return snapshots.some((s) => s.oversoldUnits > 0);
};

const isChannelRestricted = (
  roomId: string,
  channelConfigs: ChannelConfig[]
): boolean => {
  const enabledChannels = channelConfigs.filter(
    (c) => c.roomId === roomId && c.enabled
  );
  if (enabledChannels.length === 0) return false;
  const availableTotal = enabledChannels.reduce(
    (sum, c) => sum + (c.totalInventory - c.reservedInventory),
    0
  );
  return availableTotal === 0;
};

export const explainAvailability = (
  room: Room,
  date: string,
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  orders: Order[],
  channelConfigs: ChannelConfig[],
  cleaningSchedules: CleaningSchedule[],
  dayStatus?: CalendarDayStatus
): AvailabilityExplanation => {
  const today = getToday();
  const activeOrders = getActiveOrdersForDate(room.id, date, orders);
  const dateMaintenances = getMaintenanceForDate(room.id, date, maintenances);
  const dateLocks = getLocksForDate(room.id, date, locks);
  const cleaning = getCleaningStatus(room.id, date, cleaningSchedules);

  const allSnapshots = calculateAllChannelSnapshots(
    [room.id],
    date,
    date,
    orders,
    channelConfigs,
    []
  );
  const roomSnapshots = Array.from(allSnapshots.values()).filter(
    (s) => s.roomId === room.id
  );

  const totalInventory = getTotalInventory(room.id, channelConfigs);
  const soldInventory = getSoldInventory(roomSnapshots);
  const oversellRisk = hasOversellRisk(roomSnapshots);
  const channelRestricted = isChannelRestricted(room.id, channelConfigs);

  const cleaningPending =
    !!cleaning &&
    (cleaning.status === 'pending' ||
      cleaning.status === 'in_progress' ||
      cleaning.status === 'failed');
  const maintenanceBlocking = dateMaintenances.some(
    (m) => m.type === 'full_day'
  );
  const maintenancePartial = dateMaintenances.some(
    (m) => m.type !== 'full_day'
  );
  const locked = dateLocks.length > 0;
  const soldOut = soldInventory >= totalInventory && activeOrders.length > 0;
  const inventoryExhausted =
    soldInventory >= totalInventory && !soldOut && activeOrders.length > 0;

  let saleStatus: SaleStatus;
  const primaryReasons: string[] = [];
  const detailedReasons: string[] = [];

  if (maintenanceBlocking) {
    saleStatus = 'unavailable';
    primaryReasons.push('全天维修中');
    detailedReasons.push(
      `维修工单：${dateMaintenances
        .filter((m) => m.type === 'full_day')
        .map((m) => m.reason)
        .join('、')}`
    );
  } else if (locked) {
    saleStatus = 'unavailable';
    primaryReasons.push('房态锁定');
    detailedReasons.push(
      `锁房原因：${dateLocks.map((l) => l.reason).join('、')}`
    );
  } else if (cleaningPending && date === today) {
    saleStatus = 'unavailable';
    primaryReasons.push('清洁未完成');
    detailedReasons.push(
      `清洁状态：${cleaning?.status === 'pending' ? '待清洁' : cleaning?.status === 'in_progress' ? '清洁中' : '清洁失败'}`
    );
  } else if (oversellRisk) {
    saleStatus = 'unavailable';
    primaryReasons.push('渠道超卖风险');
    detailedReasons.push('多渠道库存出现超卖，请核查异常队列');
  } else if (soldOut || inventoryExhausted) {
    saleStatus = 'unavailable';
    primaryReasons.push('库存售罄');
    detailedReasons.push(`已售 ${soldInventory}/${totalInventory} 间夜`);
  } else if (maintenancePartial) {
    saleStatus = 'limited';
    primaryReasons.push('半日维修限制');
    detailedReasons.push(
      `半日维修：${dateMaintenances
        .filter((m) => m.type !== 'full_day')
        .map((m) => (m.type === 'half_day_morning' ? '上午' : '下午'))
        .join('、')}`
    );
  } else if (channelRestricted) {
    saleStatus = 'limited';
    primaryReasons.push('渠道库存受限');
    detailedReasons.push('仅部分开放渠道可预订');
  } else if (cleaningPending && date !== today) {
    saleStatus = 'limited';
    primaryReasons.push('清洁安排待确认');
    detailedReasons.push('入住当日需完成清洁后方可入住');
  } else if (dayStatus?.conflicts && dayStatus.conflicts.length > 0) {
    saleStatus = 'limited';
    primaryReasons.push('存在预订冲突');
    detailedReasons.push(...dayStatus.conflicts.map((c) => c.message));
  } else {
    saleStatus = 'available';
    primaryReasons.push('正常可售');
    const remaining = totalInventory - soldInventory;
    detailedReasons.push(`剩余库存 ${remaining}/${totalInventory} 间夜`);
  }

  if (activeOrders.length > 0 && saleStatus === 'available') {
    detailedReasons.push(`当前有效订单 ${activeOrders.length} 笔`);
  }

  return {
    saleStatus,
    primaryReason: primaryReasons[0] || '状态未知',
    detailedReasons,
    factors: {
      maintenance: maintenanceBlocking || maintenancePartial,
      locked,
      soldOut: soldOut || inventoryExhausted,
      channelRestricted,
      inventoryExhausted,
      cleaningPending,
      oversellRisk,
    },
    availableInventory: Math.max(0, totalInventory - soldInventory),
    totalInventory,
    conflictingOrders: activeOrders.length > 0 ? activeOrders.map((o) => o.id) : undefined,
    conflictingMaintenances:
      dateMaintenances.length > 0 ? dateMaintenances.map((m) => m.id) : undefined,
    conflictingLocks: dateLocks.length > 0 ? dateLocks.map((l) => l.id) : undefined,
  };
};

export const batchExplainAvailability = (
  rooms: Room[],
  startDate: string,
  endDate: string,
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  orders: Order[],
  channelConfigs: ChannelConfig[],
  cleaningSchedules: CleaningSchedule[],
  calendarStatus: Map<string, CalendarDayStatus>
): Map<string, AvailabilityExplanation> => {
  const result = new Map<string, AvailabilityExplanation>();

  for (const room of rooms) {
    let current = startDate;
    while (current <= endDate) {
      const key = `${room.id}_${current}`;
      const dayStatus = calendarStatus.get(key);
      const explanation = explainAvailability(
        room,
        current,
        maintenances,
        locks,
        orders,
        channelConfigs,
        cleaningSchedules,
        dayStatus
      );
      result.set(key, explanation);

      const d = new Date(current);
      d.setDate(d.getDate() + 1);
      current = d.toISOString().split('T')[0];
    }
  }

  return result;
};

export const formatSaleStatusText = (status: SaleStatus): string => {
  switch (status) {
    case 'available':
      return '可售';
    case 'limited':
      return '限售';
    case 'unavailable':
      return '不可售';
  }
};

export const getSaleStatusColor = (status: SaleStatus): string => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'limited':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'unavailable':
      return 'bg-red-100 text-red-800 border-red-200';
  }
};
