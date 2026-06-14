import type {
  Order,
  Room,
  PriceVersion,
  HolidayPrice,
  LongStayDiscount,
  MaintenanceRecord,
  LockRecord,
  ReleaseRecord,
  CalendarDayStatus,
  RescheduleValidationResult,
  PartialCancelValidationResult,
  BenefitSource,
} from '../types';
import {
  getNightsBetween,
  getDatesForNights,
  getDaysDiff,
  getToday,
  isDateInRange,
} from './dateUtils';
import { calculatePrice } from './priceCalculator';
import { checkAvailability } from './availabilityCalculator';
import {
  canReschedule,
  canPartialCancel,
} from './orderStateMachine';
import {
  calculatePartialRefund,
  BENEFIT_DEDUCTION_RULES,
} from './refundCalculator';

interface ValidateRescheduleParams {
  order: Order;
  room: Room;
  newCheckinDate: string;
  newCheckoutDate: string;
  priceVersions: PriceVersion[];
  holidayPrices: HolidayPrice[];
  longStayDiscounts: LongStayDiscount[];
  calendarStatus: Map<string, CalendarDayStatus>;
  maintenances: MaintenanceRecord[];
  locks: LockRecord[];
  releases: ReleaseRecord[];
  allOrders: Order[];
  rescheduleDate?: string;
}

const checkBenefitsValidity = (
  originalBenefit: BenefitSource,
  orderCreatedAt: number,
  newCheckinDate: string
): { stillValid: boolean; expiredBenefits: BenefitSource[] } => {
  const today = getToday();
  const daysToCheckin = getDaysDiff(today, newCheckinDate);
  const expiredBenefits: BenefitSource[] = [];

  if (originalBenefit === 'none') {
    return { stillValid: true, expiredBenefits };
  }

  const orderAgeDays = Math.floor((Date.now() - orderCreatedAt) / (1000 * 60 * 60 * 24));

  if (originalBenefit === 'coupon') {
    if (daysToCheckin > 30 || orderAgeDays > 60) {
      expiredBenefits.push('coupon');
    }
  } else if (originalBenefit === 'promotion') {
    if (daysToCheckin > 14) {
      expiredBenefits.push('promotion');
    }
  } else if (originalBenefit === 'member_discount') {
    if (orderAgeDays > 180) {
      expiredBenefits.push('member_discount');
    }
  }

  return {
    stillValid: expiredBenefits.length === 0,
    expiredBenefits,
  };
};

export const validateReschedule = (
  params: ValidateRescheduleParams
): RescheduleValidationResult => {
  const {
    order,
    room,
    newCheckinDate,
    newCheckoutDate,
    priceVersions,
    holidayPrices,
    longStayDiscounts,
    calendarStatus,
    allOrders,
    rescheduleDate,
  } = params;

  const conflicts: string[] = [];
  const today = rescheduleDate || getToday();

  if (!canReschedule(order)) {
    return {
      allowed: false,
      priceChanged: false,
      oldPrice: order.priceSnapshot.totalPrice,
      newPrice: order.priceSnapshot.totalPrice,
      priceDiff: 0,
      lockPriceViolation: order.lockedPrice,
      benefitsStillValid: true,
      expiredBenefits: [],
      refundRequired: false,
      refundAmount: 0,
      additionalPayment: 0,
      cancellationFees: 0,
      conflicts: ['当前订单状态不允许改期'],
      newAvailabilityAvailable: false,
    };
  }

  const newNights = getNightsBetween(newCheckinDate, newCheckoutDate);
  const oldNights = getNightsBetween(order.checkinDate, order.checkoutDate);

  if (newNights < 1) {
    conflicts.push('新入住日期必须早于退房日期');
  }

  const lockPriceViolation = order.lockedPrice;
  if (lockPriceViolation) {
    conflicts.push('订单已锁价，改期将无法保护原价格');
  }

  const availabilityResult = checkAvailability(
    room.id,
    newCheckinDate,
    newCheckoutDate,
    calendarStatus
  );

  if (!availabilityResult.available) {
    conflicts.push(
      `以下日期不可用：${availabilityResult.unavailableDates.join('、')}`
    );
    conflicts.push(...availabilityResult.conflicts);
  }

  const overlappingExisting = allOrders.filter(
    (o) =>
      o.id !== order.id &&
      o.roomId === room.id &&
      !['cancelled', 'partially_cancelled'].includes(o.status) &&
      ((isDateInRange(newCheckinDate, o.checkinDate, o.checkoutDate) ||
        isDateInRange(newCheckoutDate, o.checkinDate, o.checkoutDate) ||
        isDateInRange(o.checkinDate, newCheckinDate, newCheckoutDate) ||
        isDateInRange(o.checkoutDate, newCheckinDate, newCheckoutDate)))
  );

  if (overlappingExisting.length > 0) {
    conflicts.push(
      `新日期与 ${overlappingExisting.length} 笔现有订单冲突`
    );
  }

  const originalBenefit = order.priceSnapshot.benefitSource;
  const originalBenefitAmount = order.priceSnapshot.benefitAmount;
  const { stillValid, expiredBenefits } = checkBenefitsValidity(
    originalBenefit,
    order.createdAt,
    newCheckinDate
  );

  const effectiveBenefitSource = stillValid ? originalBenefit : 'none';
  const effectiveBenefitAmount = stillValid ? originalBenefitAmount : 0;

  const newPriceResult = calculatePrice(
    room,
    newCheckinDate,
    newCheckoutDate,
    priceVersions,
    holidayPrices,
    longStayDiscounts,
    null,
    effectiveBenefitSource,
    effectiveBenefitAmount
  );

  const oldPrice = order.priceSnapshot.totalPrice;
  const newPrice = newPriceResult.totalPrice;
  const priceDiff = newPrice - oldPrice;
  const priceChanged = Math.abs(priceDiff) > 0.01;

  const daysBeforeCheckin = getDaysDiff(today, order.checkinDate);
  let cancellationFees = 0;
  let refundAmount = 0;
  let refundRequired = false;
  let additionalPayment = 0;

  if (daysBeforeCheckin < 7 && daysBeforeCheckin >= 0) {
    cancellationFees = oldPrice * 0.1;
  }

  if (priceDiff < 0) {
    refundRequired = true;
    refundAmount = Math.abs(priceDiff) - cancellationFees;
    refundAmount = Math.max(0, refundAmount);
  } else if (priceDiff > 0) {
    additionalPayment = priceDiff + cancellationFees;
  } else {
    additionalPayment = cancellationFees;
  }

  return {
    allowed: conflicts.length === 0,
    priceChanged,
    oldPrice,
    newPrice,
    priceDiff,
    lockPriceViolation,
    benefitsStillValid: stillValid,
    expiredBenefits,
    refundRequired,
    refundAmount,
    additionalPayment,
    cancellationFees,
    conflicts,
    newAvailabilityAvailable: availabilityResult.available,
  };
};

interface ValidatePartialCancelParams {
  order: Order;
  cancelCheckinDate: string;
  cancelCheckoutDate: string;
  maintenances: MaintenanceRecord[];
  locks: LockRecord[];
  releases: ReleaseRecord[];
  cancelDate?: string;
}

export const validatePartialCancel = (
  params: ValidatePartialCancelParams
): PartialCancelValidationResult => {
  const {
    order,
    cancelCheckinDate,
    cancelCheckoutDate,
    cancelDate,
  } = params;

  const conflicts: string[] = [];
  const today = cancelDate || getToday();

  if (!canPartialCancel(order)) {
    return {
      allowed: false,
      refundAmount: 0,
      cancelFee: 0,
      benefitDeduction: 0,
      remainingNights: 0,
      cancelledNights: 0,
      remainingPrice: 0,
      priceLocked: order.lockedPrice,
      conflicts: ['当前订单状态不允许部分取消'],
    };
  }

  const totalNights = getNightsBetween(order.checkinDate, order.checkoutDate);
  const cancelledNights = getNightsBetween(cancelCheckinDate, cancelCheckoutDate);
  const remainingNights = totalNights - cancelledNights;

  if (cancelledNights < 1) {
    conflicts.push('至少取消1晚');
  }
  if (remainingNights < 1) {
    conflicts.push('部分取消后至少保留1晚，请使用全额取消');
  }

  const allOrderDates = getDatesForNights(order.checkinDate, order.checkoutDate);
  const cancelDates = getDatesForNights(cancelCheckinDate, cancelCheckoutDate);
  const allInOrder = cancelDates.every((d) => allOrderDates.includes(d));
  if (!allInOrder) {
    conflicts.push('取消日期范围必须在原订单日期内');
  }

  if (cancelCheckinDate === order.checkinDate) {
    const daysBeforeCheckin = getDaysDiff(today, order.checkinDate);
    if (daysBeforeCheckin < 1) {
      conflicts.push('入住当天不可取消首晚');
    }
  }

  const refundResult = calculatePartialRefund(
    order,
    cancelledNights,
    totalNights,
    'partial_cancel',
    today
  );

  const nightPrice = order.priceSnapshot.totalPrice / totalNights;
  const remainingPrice = nightPrice * remainingNights;

  return {
    allowed: conflicts.length === 0,
    refundAmount: refundResult.refundAmount,
    cancelFee: refundResult.cancelFee,
    benefitDeduction: refundResult.benefitDeduction,
    remainingNights,
    cancelledNights,
    remainingPrice,
    priceLocked: order.lockedPrice,
    conflicts,
  };
};

export const getBenefitExpirationReasons = (
  expiredBenefits: BenefitSource[]
): string[] => {
  const reasons: string[] = [];
  for (const benefit of expiredBenefits) {
    const deductionRate = (BENEFIT_DEDUCTION_RULES[benefit] || 0) * 100;
    switch (benefit) {
      case 'coupon':
        reasons.push(`优惠券已过期（有效期30天/下单60天内），将按${deductionRate}%扣除补偿`);
        break;
      case 'promotion':
        reasons.push(`促销活动已结束（需14天内入住），将按${deductionRate}%扣除补偿`);
        break;
      case 'member_discount':
        reasons.push(`会员等级权益已变更，将按${deductionRate}%扣除补偿`);
        break;
      default:
        reasons.push(`优惠权益已失效`);
    }
  }
  return reasons;
};
