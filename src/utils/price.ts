import type { Room, HolidayPrice, DiscountRule, DatePrice } from '@/types';
import { isWeekend, isBetween, dateRange } from './date';

export function fmt(n: number) {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getDailyPrice(
  room: Room,
  date: string,
  holidays: HolidayPrice[] = []
): { price: number; source: 'weekday' | 'weekend' | 'holiday' } {
  const holiday = holidays.find(
    (h) => h.roomId === room.id && isBetween(date, h.startDate, h.endDate, true)
  );
  if (holiday) return { price: holiday.price, source: 'holiday' };
  if (isWeekend(date)) return { price: room.basePriceWeekend, source: 'weekend' };
  return { price: room.basePriceWeekday, source: 'weekday' };
}

export function matchDiscount(
  room: Room,
  nights: number,
  discounts: DiscountRule[] = []
): DiscountRule | null {
  const applicable = discounts
    .filter((d) => d.roomId === room.id && nights >= d.minNights)
    .sort((a, b) => b.minNights - a.minNights);
  return applicable[0] || null;
}

export interface PricingResult {
  nights: number;
  dailyBreakdown: { date: string; price: number; source: 'weekday' | 'weekend' | 'holiday' }[];
  originalAmount: number;
  discountAmount: number;
  discountRate: number;
  discountRuleName?: string;
  finalAmount: number;
}

export function calculatePricing(
  room: Room,
  checkIn: string,
  checkOut: string,
  holidays: HolidayPrice[] = [],
  discounts: DiscountRule[] = []
): PricingResult {
  const days = dateRange(checkIn, checkOut);
  const dailyBreakdown = days.map((d) => ({ date: d, ...getDailyPrice(room, d, holidays) }));
  const originalAmount = dailyBreakdown.reduce((sum, x) => sum + x.price, 0);
  const nights = days.length;
  const rule = matchDiscount(room, nights, discounts);
  const discountRate = rule ? rule.discountRate : 1;
  const discountAmount = Math.round(originalAmount * (1 - discountRate));
  const finalAmount = originalAmount - discountAmount;
  return {
    nights,
    dailyBreakdown,
    originalAmount,
    discountAmount,
    discountRate,
    discountRuleName: rule ? `连住 ${rule.minNights} 晚及以上` : undefined,
    finalAmount,
  };
}

export interface CancelFeeResult {
  daysBeforeCheckIn: number;
  feeRate: number;
  cancelFee: number;
  refundAmount: number;
  ruleText: string;
}

export function calculateCancelFee(
  checkIn: string,
  paidAmount: number,
  cancelAt: Date = new Date()
): CancelFeeResult {
  const ci = new Date(checkIn + 'T14:00:00');
  const diffMs = ci.getTime() - cancelAt.getTime();
  const daysBefore = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let feeRate = 0;
  let ruleText = '';
  if (daysBefore >= 7) {
    feeRate = 0;
    ruleText = '入住前 7 天及以上取消：全额退款';
  } else if (daysBefore >= 3) {
    feeRate = 0.3;
    ruleText = '入住前 3–6 天取消：扣除 30% 房费';
  } else {
    feeRate = 1;
    ruleText = '入住前不足 3 天取消：扣除全额房费';
  }

  const cancelFee = Math.round(paidAmount * feeRate);
  const refundAmount = paidAmount - cancelFee;
  return { daysBeforeCheckIn: daysBefore, feeRate, cancelFee, refundAmount, ruleText };
}

export const CANCEL_RULES = [
  { range: '入住前 7 天及以上', fee: '0%', desc: '全额退款' },
  { range: '入住前 3–6 天', fee: '30%', desc: '扣除 30% 房费' },
  { range: '入住前 < 3 天', fee: '100%', desc: '扣除全额房费' },
];

export function buildCalendarPrices(
  room: Room,
  monthStart: string,
  monthEnd: string,
  holidays: HolidayPrice[],
  bookedRanges: { start: string; end: string; orderId: string }[] = [],
  maintenances: { start: string; end: string }[] = []
): Record<string, DatePrice> {
  const days = dateRange(monthStart, monthEnd);
  const result: Record<string, DatePrice> = {};
  for (const d of days) {
    const { price, source } = getDailyPrice(room, d, holidays);
    let status: DatePrice['status'] = 'available';
    const booked = bookedRanges.find((r) => isBetween(d, r.start, r.end));
    const maintenance = maintenances.find((r) => isBetween(d, r.start, r.end, true));
    if (maintenance) status = 'maintenance';
    else if (booked) status = 'booked';
    result[d] = {
      date: d,
      price,
      source,
      status,
      orderId: booked?.orderId,
    };
  }
  return result;
}
