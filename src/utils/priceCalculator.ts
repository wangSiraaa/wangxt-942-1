import type { Room, PriceVersion, HolidayPrice, LongStayDiscount, Order, PriceCalculationResult, BenefitSource } from '../types';
import { isHoliday, isWeekend, getDatesForNights, getNightsBetween, isDateInRange } from './dateUtils';

export const getActivePriceVersion = (
  roomId: string,
  date: string,
  priceVersions: PriceVersion[]
): PriceVersion | null => {
  const activeVersions = priceVersions.filter(
    pv => pv.roomId === roomId && 
          pv.status === 'active' && 
          isDateInRange(date, pv.startDate, pv.endDate)
  );
  return activeVersions.length > 0 ? activeVersions[0] : null;
};

export const getHolidayPrice = (
  roomId: string,
  date: string,
  holidayPrices: HolidayPrice[]
): HolidayPrice | null => {
  return holidayPrices.find(hp => hp.roomId === roomId && hp.date === date) || null;
};

export const getLongStayDiscount = (
  roomId: string,
  nights: number,
  longStayDiscounts: LongStayDiscount[]
): LongStayDiscount | null => {
  const discounts = longStayDiscounts
    .filter(d => d.roomId === roomId && nights >= d.minNights && nights <= d.maxNights)
    .sort((a, b) => b.discountPercent - a.discountPercent);
  return discounts.length > 0 ? discounts[0] : null;
};

export const calculateDailyPrice = (
  room: Room,
  date: string,
  priceVersions: PriceVersion[],
  holidayPrices: HolidayPrice[]
): { basePrice: number; holidayPremium: number; weekendPremium: number; finalPrice: number } => {
  const holidayPrice = getHolidayPrice(room.id, date, holidayPrices);
  if (holidayPrice) {
    return {
      basePrice: room.basePrice,
      holidayPremium: holidayPrice.price - room.basePrice,
      weekendPremium: 0,
      finalPrice: holidayPrice.price
    };
  }

  const priceVersion = getActivePriceVersion(room.id, date, priceVersions);
  const basePrice = priceVersion?.basePrice || room.basePrice;
  
  let holidayPremium = 0;
  let weekendPremium = 0;
  
  if (isHoliday(date)) {
    holidayPremium = basePrice * (priceVersion?.holidayPremium || 0.3);
  }
  
  if (isWeekend(date)) {
    weekendPremium = basePrice * (priceVersion?.weekendPremium || 0.1);
  }

  return {
    basePrice,
    holidayPremium,
    weekendPremium,
    finalPrice: basePrice + holidayPremium + weekendPremium
  };
};

export const calculatePrice = (
  room: Room,
  checkinDate: string,
  checkoutDate: string,
  priceVersions: PriceVersion[],
  holidayPrices: HolidayPrice[],
  longStayDiscounts: LongStayDiscount[],
  existingOrder?: Order | null,
  benefitSource: BenefitSource = 'none',
  benefitAmount: number = 0
): PriceCalculationResult => {
  const nights = getNightsBetween(checkinDate, checkoutDate);
  const dates = getDatesForNights(checkinDate, checkoutDate);
  
  if (existingOrder && existingOrder.lockedPrice) {
    return {
      basePrice: existingOrder.priceSnapshot.basePrice,
      holidayPremium: existingOrder.priceSnapshot.holidayPremium,
      weekendPremium: existingOrder.priceSnapshot.weekendPremium,
      longStayDiscount: existingOrder.priceSnapshot.longStayDiscount,
      otherDiscounts: existingOrder.priceSnapshot.otherDiscounts,
      subtotal: existingOrder.priceSnapshot.totalPrice,
      benefitSource: existingOrder.priceSnapshot.benefitSource,
      benefitAmount: existingOrder.priceSnapshot.benefitAmount,
      totalPrice: existingOrder.priceSnapshot.totalPrice,
      dailyBreakdown: dates.map(d => ({ date: d, price: existingOrder.priceSnapshot.totalPrice / nights }))
    };
  }

  let basePrice = 0;
  let holidayPremium = 0;
  let weekendPremium = 0;
  const dailyBreakdown: { date: string; price: number }[] = [];

  for (const date of dates) {
    const daily = calculateDailyPrice(room, date, priceVersions, holidayPrices);
    basePrice += daily.basePrice;
    holidayPremium += daily.holidayPremium;
    weekendPremium += daily.weekendPremium;
    dailyBreakdown.push({ date, price: daily.finalPrice });
  }

  const subtotal = basePrice + holidayPremium + weekendPremium;
  
  const longStayDiscountConfig = getLongStayDiscount(room.id, nights, longStayDiscounts);
  const longStayDiscount = longStayDiscountConfig ? subtotal * (longStayDiscountConfig.discountPercent / 100) : 0;
  
  const otherDiscounts = 0;
  
  const totalBeforeBenefit = subtotal - longStayDiscount - otherDiscounts;
  const totalPrice = Math.max(0, totalBeforeBenefit - benefitAmount);

  return {
    basePrice,
    holidayPremium,
    weekendPremium,
    longStayDiscount,
    otherDiscounts,
    subtotal,
    benefitSource,
    benefitAmount,
    totalPrice,
    dailyBreakdown
  };
};

export const calculateBatchPriceUpdate = (
  roomIds: string[],
  startDate: string,
  endDate: string,
  priceAdjustment: number,
  adjustmentType: 'fixed' | 'percent',
  existingPrices: HolidayPrice[]
): HolidayPrice[] => {
  const dates = getDatesForNights(startDate, endDate);
  const newPrices: HolidayPrice[] = [];

  for (const roomId of roomIds) {
    for (const date of dates) {
      const existing = existingPrices.find(hp => hp.roomId === roomId && hp.date === date);
      let newPrice = existing?.price || 0;
      
      if (adjustmentType === 'fixed') {
        newPrice = Math.max(0, newPrice + priceAdjustment);
      } else {
        newPrice = Math.max(0, newPrice * (1 + priceAdjustment / 100));
      }

      newPrices.push({
        id: existing?.id || `hp_${roomId}_${date}_${Date.now()}`,
        roomId,
        date,
        price: Math.round(newPrice * 100) / 100,
        reason: '批量调整',
        createdAt: Date.now()
      });
    }
  }

  return newPrices;
};
