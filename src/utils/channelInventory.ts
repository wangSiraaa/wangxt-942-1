import type { 
  ChannelType, ChannelConfig, ChannelInventorySnapshot, 
  Room, Order, OrderChannelInfo, MaintenanceRecord, LockRecord, ReleaseRecord 
} from '../types';
import { getDatesBetween, isDateInRange, getToday } from './dateUtils';

export const CHANNEL_NAMES: Record<ChannelType, string> = {
  direct: '直销',
  ota: 'OTA平台',
  corporate_longstay: '企业长租',
  event_buyout: '临时包栋',
};

export const CHANNEL_COLORS: Record<ChannelType, string> = {
  direct: 'bg-green-100 text-green-800 border-green-300',
  ota: 'bg-blue-100 text-blue-800 border-blue-300',
  corporate_longstay: 'bg-purple-100 text-purple-800 border-purple-300',
  event_buyout: 'bg-orange-100 text-orange-800 border-orange-300',
};

export const createDefaultChannelConfig = (roomId: string, channel: ChannelType): ChannelConfig => {
  const configs: Record<ChannelType, Partial<ChannelConfig>> = {
    direct: {
      channelName: '直销',
      enabled: true,
      totalInventory: 1,
      reservedInventory: 0,
      oversellThreshold: 0,
      commissionRate: 0,
    },
    ota: {
      channelName: 'OTA平台',
      enabled: true,
      totalInventory: 1,
      reservedInventory: 0,
      minPrice: undefined,
      maxPrice: undefined,
      oversellThreshold: 0,
      commissionRate: 0.15,
    },
    corporate_longstay: {
      channelName: '企业长租',
      enabled: false,
      totalInventory: 1,
      reservedInventory: 0,
      oversellThreshold: 0,
      commissionRate: 0.05,
    },
    event_buyout: {
      channelName: '临时包栋',
      enabled: false,
      totalInventory: 1,
      reservedInventory: 0,
      oversellThreshold: 0,
      commissionRate: 0,
    },
  };

  return {
    id: `channel_${roomId}_${channel}_${Date.now()}`,
    roomId,
    channel,
    ...configs[channel],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as ChannelConfig;
};

export const initializeChannelConfigs = (rooms: Room[]): ChannelConfig[] => {
  const configs: ChannelConfig[] = [];
  const channels: ChannelType[] = ['direct', 'ota', 'corporate_longstay', 'event_buyout'];
  
  for (const room of rooms) {
    for (const channel of channels) {
      configs.push(createDefaultChannelConfig(room.id, channel));
    }
  }
  
  return configs;
};

export const getChannelConfig = (
  roomId: string,
  channel: ChannelType,
  configs: ChannelConfig[]
): ChannelConfig | undefined => {
  return configs.find(c => c.roomId === roomId && c.channel === channel);
};

export const getOrdersForChannel = (
  roomId: string,
  date: string,
  channel: ChannelType,
  orders: Order[],
  orderChannels: OrderChannelInfo[]
): Order[] => {
  const channelOrderIds = orderChannels
    .filter(oc => oc.channel === channel)
    .map(oc => oc.orderId);
  
  return orders.filter(o => 
    o.roomId === roomId &&
    isDateInRange(date, o.checkinDate, o.checkoutDate) &&
    !['cancelled', 'partially_cancelled'].includes(o.status) &&
    channelOrderIds.includes(o.id)
  );
};

export const calculateChannelInventorySnapshot = (
  roomId: string,
  date: string,
  channel: ChannelType,
  configs: ChannelConfig[],
  orders: Order[],
  orderChannels: OrderChannelInfo[],
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  releases: ReleaseRecord[]
): ChannelInventorySnapshot => {
  const config = getChannelConfig(roomId, channel, configs);
  const totalUnits = config?.totalInventory || 1;
  const reservedUnits = config?.reservedInventory || 0;
  
  const channelOrders = getOrdersForChannel(roomId, date, channel, orders, orderChannels);
  const soldUnits = channelOrders.length;
  
  const hasMaintenance = maintenances.some(m => 
    m.roomId === roomId && 
    isDateInRange(date, m.startDate, m.endDate) &&
    m.type === 'full_day'
  );
  
  const isLocked = locks.some(l => 
    l.roomId === roomId && 
    isDateInRange(date, l.startDate, l.endDate) &&
    !l.releasedAt
  );
  
  const isReleased = releases.some(r => r.roomId === roomId && r.date === date);
  
  let availableUnits = totalUnits - reservedUnits - soldUnits;
  let oversoldUnits = 0;
  
  if (hasMaintenance && !isReleased) {
    availableUnits = 0;
  }
  
  if (isLocked && !isReleased) {
    availableUnits = 0;
  }
  
  if (availableUnits < 0) {
    oversoldUnits = Math.abs(availableUnits);
    availableUnits = 0;
  }
  
  return {
    date,
    roomId,
    channel,
    totalUnits,
    soldUnits,
    reservedUnits,
    availableUnits,
    oversoldUnits,
  };
};

export const calculateAllChannelSnapshots = (
  rooms: Room[],
  startDate: string,
  endDate: string,
  configs: ChannelConfig[],
  orders: Order[],
  orderChannels: OrderChannelInfo[],
  maintenances: MaintenanceRecord[],
  locks: LockRecord[],
  releases: ReleaseRecord[]
): Map<string, ChannelInventorySnapshot> => {
  const snapshots = new Map<string, ChannelInventorySnapshot>();
  const dates = getDatesBetween(startDate, endDate);
  const channels: ChannelType[] = ['direct', 'ota', 'corporate_longstay', 'event_buyout'];
  
  for (const room of rooms) {
    for (const date of dates) {
      for (const channel of channels) {
        const snapshot = calculateChannelInventorySnapshot(
          room.id, date, channel, configs, orders, orderChannels,
          maintenances, locks, releases
        );
        snapshots.set(`${room.id}_${date}_${channel}`, snapshot);
      }
    }
  }
  
  return snapshots;
};

export const checkChannelOversell = (
  snapshots: Map<string, ChannelInventorySnapshot>
): Array<{ snapshot: ChannelInventorySnapshot; message: string }> => {
  const issues: Array<{ snapshot: ChannelInventorySnapshot; message: string }> = [];
  
  for (const snapshot of snapshots.values()) {
    if (snapshot.oversoldUnits > 0) {
      issues.push({
        snapshot,
        message: `${CHANNEL_NAMES[snapshot.channel]}渠道在${snapshot.date}超卖${snapshot.oversoldUnits}单位`,
      });
    }
  }
  
  return issues;
};

export const transferInventoryBetweenChannels = (
  roomId: string,
  date: string,
  fromChannel: ChannelType,
  toChannel: ChannelType,
  units: number,
  configs: ChannelConfig[]
): ChannelConfig[] => {
  const fromConfig = getChannelConfig(roomId, fromChannel, configs);
  const toConfig = getChannelConfig(roomId, toChannel, configs);
  
  if (!fromConfig || !toConfig) return configs;
  if (fromConfig.totalInventory < units) return configs;
  
  return configs.map(c => {
    if (c.id === fromConfig.id) {
      return { ...c, totalInventory: c.totalInventory - units, updatedAt: Date.now() };
    }
    if (c.id === toConfig.id) {
      return { ...c, totalInventory: c.totalInventory + units, updatedAt: Date.now() };
    }
    return c;
  });
};

export const getChannelOrderInfo = (
  orderId: string,
  orderChannels: OrderChannelInfo[]
): OrderChannelInfo | undefined => {
  return orderChannels.find(oc => oc.orderId === orderId);
};

export const calculateChannelRevenue = (
  orders: Order[],
  orderChannels: OrderChannelInfo[],
  channel: ChannelType,
  startDate: string,
  endDate: string
): { totalRevenue: number; commission: number; netRevenue: number; orderCount: number } => {
  const channelOrderIds = orderChannels
    .filter(oc => oc.channel === channel)
    .map(oc => oc.orderId);
  
  const channelOrders = orders.filter(o => 
    channelOrderIds.includes(o.id) &&
    !['cancelled'].includes(o.status) &&
    isDateInRange(o.checkinDate, startDate, endDate)
  );
  
  let totalRevenue = 0;
  let commission = 0;
  
  for (const order of channelOrders) {
    const oc = orderChannels.find(oc => oc.orderId === order.id);
    const orderRevenue = order.priceSnapshot.totalPrice;
    totalRevenue += orderRevenue;
    commission += oc?.commissionAmount || 0;
  }
  
  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    commission: Math.round(commission * 100) / 100,
    netRevenue: Math.round((totalRevenue - commission) * 100) / 100,
    orderCount: channelOrders.length,
  };
};

export const checkChannelConflict = (
  roomId: string,
  date: string,
  configs: ChannelConfig[],
  orders: Order[],
  orderChannels: OrderChannelInfo[]
): { hasConflict: boolean; conflicts: string[] } => {
  const conflicts: string[] = [];
  const channels: ChannelType[] = ['direct', 'ota', 'corporate_longstay', 'event_buyout'];
  
  let totalSold = 0;
  let totalAvailable = 0;
  
  for (const channel of channels) {
    const snapshot = calculateChannelInventorySnapshot(
      roomId, date, channel, configs, orders, orderChannels, [], [], []
    );
    totalSold += snapshot.soldUnits;
    totalAvailable += snapshot.availableUnits;
    
    if (snapshot.oversoldUnits > 0) {
      conflicts.push(`${CHANNEL_NAMES[channel]}渠道超卖${snapshot.oversoldUnits}单位`);
    }
  }
  
  if (totalSold > 1) {
    conflicts.push(`多渠道总销售量(${totalSold})超过库存(1)`);
  }
  
  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
};
