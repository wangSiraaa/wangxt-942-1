import type { Order, RefundCalculationResult, BenefitSource, RefundReason } from '../types';
import { getDaysDiff, getToday } from './dateUtils';

export interface CancelFeeRule {
  minDaysBeforeCheckin: number;
  maxDaysBeforeCheckin: number;
  feeRate: number;
  description: string;
}

export const CANCEL_FEE_RULES: CancelFeeRule[] = [
  { minDaysBeforeCheckin: 7, maxDaysBeforeCheckin: Infinity, feeRate: 0, description: '入住前7天及以上：免费取消' },
  { minDaysBeforeCheckin: 3, maxDaysBeforeCheckin: 7, feeRate: 0.3, description: '入住前3-7天：扣30%' },
  { minDaysBeforeCheckin: 1, maxDaysBeforeCheckin: 3, feeRate: 0.5, description: '入住前1-3天：扣50%' },
  { minDaysBeforeCheckin: 0, maxDaysBeforeCheckin: 1, feeRate: 0.8, description: '入住当天或逾期：扣80%' },
];

export const BENEFIT_DEDUCTION_RULES: Record<BenefitSource, number> = {
  coupon: 1,
  member_discount: 0.5,
  promotion: 0.3,
  long_stay: 0,
  none: 0,
};

export const getCancelFeeRule = (daysBeforeCheckin: number): CancelFeeRule => {
  const rule = CANCEL_FEE_RULES.find(
    r => daysBeforeCheckin >= r.minDaysBeforeCheckin && daysBeforeCheckin < r.maxDaysBeforeCheckin
  );
  return rule || CANCEL_FEE_RULES[CANCEL_FEE_RULES.length - 1];
};

export const calculateBenefitDeduction = (
  usedBenefits: BenefitSource[],
  totalAmount: number
): number => {
  let deduction = 0;
  for (const benefit of usedBenefits) {
    const rate = BENEFIT_DEDUCTION_RULES[benefit] || 0;
    deduction += totalAmount * rate;
  }
  return Math.min(deduction, totalAmount);
};

export const calculateRefund = (
  order: Order,
  reason: RefundReason,
  refundDate: string = getToday(),
  customUsedBenefits?: BenefitSource[]
): RefundCalculationResult => {
  const steps: string[] = [];
  const paidAmount = order.paidAmount;
  
  steps.push(`已支付金额：¥${paidAmount.toFixed(2)}`);

  if (paidAmount <= 0) {
    return {
      daysBeforeCheckin: 0,
      paidAmount: 0,
      usedBenefits: [],
      benefitDeduction: 0,
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
      calculationSteps: ['无已支付金额，无需退款']
    };
  }

  const daysBeforeCheckin = getDaysDiff(refundDate, order.checkinDate);
  steps.push(`距离入住还有 ${daysBeforeCheckin} 天`);

  const usedBenefits = customUsedBenefits || 
    (order.priceSnapshot.benefitSource !== 'none' ? [order.priceSnapshot.benefitSource] : []);
  
  if (usedBenefits.length > 0) {
    steps.push(`使用的优惠：${usedBenefits.join(', ')}`);
  }

  let benefitDeduction = 0;
  if (reason === 'guest_cancel' || reason === 'reschedule' || reason === 'partial_cancel') {
    benefitDeduction = calculateBenefitDeduction(usedBenefits, paidAmount);
    if (benefitDeduction > 0) {
      steps.push(`优惠抵扣金额：¥${benefitDeduction.toFixed(2)}`);
    }
  }

  let cancelFeeRate = 0;
  let cancelFee = 0;

  if (reason === 'guest_cancel' || reason === 'partial_cancel') {
    const rule = getCancelFeeRule(daysBeforeCheckin);
    cancelFeeRate = rule.feeRate;
    steps.push(rule.description);
    
    const cancelFeeBase = paidAmount - benefitDeduction;
    cancelFee = cancelFeeBase * cancelFeeRate;
    steps.push(`违约金计算：(¥${paidAmount.toFixed(2)} - ¥${benefitDeduction.toFixed(2)}) × ${(cancelFeeRate * 100).toFixed(0)}% = ¥${cancelFee.toFixed(2)}`);
  } else if (reason === 'reschedule') {
    cancelFeeRate = 0.1;
    cancelFee = (paidAmount - benefitDeduction) * cancelFeeRate;
    steps.push(`改期手续费：10%，即 ¥${cancelFee.toFixed(2)}`);
  } else if (reason === 'host_cancel' || reason === 'maintenance' || reason === 'system') {
    steps.push('房东/系统原因取消：全额退款');
  }

  const refundAmount = Math.max(0, paidAmount - benefitDeduction - cancelFee);
  steps.push(`最终退款金额：¥${paidAmount.toFixed(2)} - ¥${benefitDeduction.toFixed(2)} - ¥${cancelFee.toFixed(2)} = ¥${refundAmount.toFixed(2)}`);

  return {
    daysBeforeCheckin,
    paidAmount,
    usedBenefits,
    benefitDeduction,
    cancelFeeRate,
    cancelFee,
    refundAmount,
    calculationSteps: steps
  };
};

export const calculatePartialRefund = (
  order: Order,
  cancelledNights: number,
  totalNights: number,
  reason: RefundReason,
  refundDate: string = getToday()
): RefundCalculationResult => {
  const partialOrder = {
    ...order,
    paidAmount: order.paidAmount * (cancelledNights / totalNights)
  };
  
  const result = calculateRefund(partialOrder, reason, refundDate);
  result.calculationSteps.unshift(
    `部分取消：${cancelledNights}/${totalNights} 晚，按比例计算退款基数：¥${partialOrder.paidAmount.toFixed(2)}`
  );
  
  return result;
};
