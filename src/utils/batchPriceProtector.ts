import type {
  Room,
  Order,
  HolidayPrice,
  PriceVersion,
  BatchPriceProtectionResult,
  OrderStatus,
} from '../types';
import { getDatesForNights, isDateInRange, getNightsBetween } from './dateUtils';

interface ProtectedOrderCheck {
  orderId: string;
  orderNo: string;
  guestName: string;
  status: OrderStatus;
  lockedPrice: boolean;
  paid: boolean;
  checkinDate: string;
  checkoutDate: string;
  protectedNights: string[];
  lockedPriceAmount: number;
  wouldBePrice: number;
  priceDiff: number;
}

const PROTECTED_STATUSES: OrderStatus[] = ['paid', 'locked', 'checkin', 'checkout', 'completed'];

const isOrderProtected = (order: Order): boolean => {
  return order.lockedPrice || PROTECTED_STATUSES.includes(order.status);
};

const calculateNightPrice = (
  roomId: string,
  date: string,
  basePrice: number,
  existingPrices: HolidayPrice[],
  priceVersions: PriceVersion[]
): number => {
  const holidayPrice = existingPrices.find(
    (hp) => hp.roomId === roomId && hp.date === date
  );
  if (holidayPrice) return holidayPrice.price;

  const activeVersion = priceVersions.find(
    (pv) =>
      pv.roomId === roomId &&
      pv.status === 'active' &&
      isDateInRange(date, pv.startDate, pv.endDate)
  );
  return activeVersion?.basePrice || basePrice;
};

export const findProtectedOrders = (
  roomIds: string[],
  startDate: string,
  endDate: string,
  orders: Order[],
  rooms: Room[]
): ProtectedOrderCheck[] => {
  const targetDates = getDatesForNights(startDate, endDate);
  const results: ProtectedOrderCheck[] = [];
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const activeOrders = orders.filter(
    (o) =>
      roomIds.includes(o.roomId) &&
      !['cancelled', 'partially_cancelled'].includes(o.status)
  );

  for (const order of activeOrders) {
    if (!isOrderProtected(order)) continue;

    const orderDates = getDatesForNights(order.checkinDate, order.checkoutDate);
    const protectedNights = orderDates.filter((d) => targetDates.includes(d));

    if (protectedNights.length === 0) continue;

    const room = roomMap.get(order.roomId);
    if (!room) continue;

    const nights = getNightsBetween(order.checkinDate, order.checkoutDate);
    const lockedPerNight = order.priceSnapshot.totalPrice / nights;
    const wouldBePerNight = lockedPerNight * 1.15;

    results.push({
      orderId: order.id,
      orderNo: order.orderNo,
      guestName: order.guestName,
      status: order.status,
      lockedPrice: order.lockedPrice,
      paid: order.paidAmount > 0,
      checkinDate: order.checkinDate,
      checkoutDate: order.checkoutDate,
      protectedNights,
      lockedPriceAmount: order.priceSnapshot.totalPrice,
      wouldBePrice: order.priceSnapshot.totalPrice + lockedPerNight * protectedNights.length * 0.15,
      priceDiff: lockedPerNight * protectedNights.length * 0.15,
    });
  }

  return results;
};

interface BatchPriceUpdateParams {
  roomIds: string[];
  startDate: string;
  endDate: string;
  priceAdjustment: number;
  adjustmentType: 'fixed' | 'percent';
  existingPrices: HolidayPrice[];
  orders: Order[];
  rooms: Room[];
  priceVersions: PriceVersion[];
  operatorId: string;
}

export const executeProtectedBatchPriceUpdate = (
  params: BatchPriceUpdateParams
): BatchPriceProtectionResult & { updatedPrices: HolidayPrice[] } => {
  const {
    roomIds,
    startDate,
    endDate,
    priceAdjustment,
    adjustmentType,
    existingPrices,
    orders,
    rooms,
    priceVersions,
  } = params;

  const targetDates = getDatesForNights(startDate, endDate);
  const protectedChecks = findProtectedOrders(roomIds, startDate, endDate, orders, rooms);
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const protectedDateRoomSet = new Set<string>();
  for (const check of protectedChecks) {
    for (const night of check.protectedNights) {
      const orderRoom = orders.find((o) => o.id === check.orderId)?.roomId;
      if (orderRoom) {
        protectedDateRoomSet.add(`${orderRoom}_${night}`);
      }
    }
  }

  const updatedPrices: HolidayPrice[] = [];
  const updatedHolidayPrices: BatchPriceProtectionResult['updatedHolidayPrices'] = [];
  let protectedDatesCount = 0;
  let updatedDatesCount = 0;

  for (const roomId of roomIds) {
    const room = roomMap.get(roomId);
    if (!room) continue;

    for (const date of targetDates) {
      const key = `${roomId}_${date}`;

      if (protectedDateRoomSet.has(key)) {
        protectedDatesCount++;
        continue;
      }

      const existing = existingPrices.find(
        (hp) => hp.roomId === roomId && hp.date === date
      );
      const basePrice = calculateNightPrice(
        roomId,
        date,
        room.basePrice,
        existingPrices,
        priceVersions
      );

      let newPrice = existing?.price || basePrice;
      if (adjustmentType === 'fixed') {
        newPrice = Math.max(0, newPrice + priceAdjustment);
      } else {
        newPrice = Math.max(0, newPrice * (1 + priceAdjustment / 100));
      }
      newPrice = Math.round(newPrice * 100) / 100;

      const oldPrice = existing?.price || basePrice;
      if (Math.abs(oldPrice - newPrice) > 0.01) {
        updatedPrices.push({
          id: existing?.id || `hp_${roomId}_${date}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          roomId,
          date,
          price: newPrice,
          reason: '批量调整（保护已锁价订单）',
          createdAt: Date.now(),
        });
        updatedHolidayPrices.push({
          roomId,
          date,
          oldPrice,
          newPrice,
        });
        updatedDatesCount++;
      }
    }
  }

  const skippedOrders = protectedChecks.map((c) => ({
    orderId: c.orderId,
    orderNo: c.orderNo,
    lockedPrice: c.lockedPriceAmount,
    wouldBePrice: c.wouldBePrice,
    diff: c.priceDiff,
  }));

  return {
    totalAffectedDates: targetDates.length * roomIds.length,
    protectedDates: protectedDatesCount,
    updatedDates: updatedDatesCount,
    skippedOrders,
    updatedHolidayPrices,
    updatedPrices,
  };
};

export const formatBatchPriceSummary = (
  result: BatchPriceProtectionResult
): string => {
  const lines: string[] = [];
  lines.push(`批量调价执行结果：`);
  lines.push(`  - 总影响房晚：${result.totalAffectedDates}`);
  lines.push(`  - 成功更新：${result.updatedDates}`);
  lines.push(`  - 保护跳过：${result.protectedDates}`);

  if (result.skippedOrders.length > 0) {
    lines.push(`  - 跳过已锁价/已支付订单：${result.skippedOrders.length} 笔`);
    const totalDiff = result.skippedOrders.reduce((sum, o) => sum + o.diff, 0);
    lines.push(`  - 共保护金额：¥${totalDiff.toFixed(2)}`);
  }

  return lines.join('\n');
};

export const validatePriceAdjustment = (
  adjustment: number,
  adjustmentType: 'fixed' | 'percent',
  currentAvgPrice: number
): { valid: boolean; reason?: string } => {
  if (adjustmentType === 'percent') {
    if (adjustment < -80) {
      return { valid: false, reason: '降价幅度不能超过80%' };
    }
    if (adjustment > 300) {
      return { valid: false, reason: '涨价幅度不能超过300%' };
    }
    if (Math.abs(adjustment) > 50) {
      return {
        valid: true,
        reason: `调整幅度较大（${adjustment > 0 ? '+' : ''}${adjustment}%），请确认`,
      };
    }
  } else {
    const percentChange = (adjustment / currentAvgPrice) * 100;
    if (percentChange < -80) {
      return { valid: false, reason: '降价幅度不能超过80%' };
    }
    if (percentChange > 300) {
      return { valid: false, reason: '涨价幅度不能超过300%' };
    }
  }
  return { valid: true };
};
