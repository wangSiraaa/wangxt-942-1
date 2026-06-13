import type { OrderStatus, Order, RefundReason, BenefitSource } from '../types';
import { calculateRefund, calculatePartialRefund } from './refundCalculator';
import { getNightsBetween } from './dateUtils';

export interface OrderStateTransition {
  from: OrderStatus;
  to: OrderStatus;
  action: string;
  allowedRoles: ('host' | 'guest' | 'operator')[];
  description: string;
}

export const ORDER_STATE_TRANSITIONS: OrderStateTransition[] = [
  { from: 'pending', to: 'confirmed', action: 'confirm', allowedRoles: ['host', 'operator'], description: '确认订单' },
  { from: 'pending', to: 'cancelled', action: 'cancel', allowedRoles: ['guest', 'host', 'operator'], description: '取消待确认订单' },
  { from: 'confirmed', to: 'paid', action: 'pay', allowedRoles: ['guest', 'operator'], description: '支付订单' },
  { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedRoles: ['guest', 'host', 'operator'], description: '取消已确认订单' },
  { from: 'paid', to: 'locked', action: 'lock', allowedRoles: ['operator'], description: '锁价' },
  { from: 'paid', to: 'checkin', action: 'checkin', allowedRoles: ['host', 'operator'], description: '办理入住' },
  { from: 'paid', to: 'cancelled', action: 'cancel', allowedRoles: ['guest', 'host', 'operator'], description: '取消已支付订单' },
  { from: 'paid', to: 'partially_cancelled', action: 'partial_cancel', allowedRoles: ['guest', 'host', 'operator'], description: '部分取消' },
  { from: 'locked', to: 'checkin', action: 'checkin', allowedRoles: ['host', 'operator'], description: '办理入住' },
  { from: 'locked', to: 'cancelled', action: 'cancel', allowedRoles: ['host', 'operator'], description: '取消已锁价订单' },
  { from: 'checkin', to: 'checkout', action: 'checkout', allowedRoles: ['host', 'operator'], description: '办理退房' },
  { from: 'checkin', to: 'cancelled', action: 'cancel', allowedRoles: ['host', 'operator'], description: '取消入住中订单' },
  { from: 'checkout', to: 'completed', action: 'complete', allowedRoles: ['host', 'operator'], description: '完成订单' },
  { from: 'cancelled', to: 'confirmed', action: 'restore', allowedRoles: ['host', 'operator'], description: '恢复已取消订单' },
  { from: 'partially_cancelled', to: 'checkin', action: 'checkin', allowedRoles: ['host', 'operator'], description: '办理入住（部分取消后）' },
];

export interface StateMachineCheckResult {
  allowed: boolean;
  reason?: string;
  nextStates: OrderStateTransition[];
}

export const checkStateTransition = (
  currentStatus: OrderStatus,
  targetAction: string,
  userRole: 'host' | 'guest' | 'operator'
): StateMachineCheckResult => {
  const possibleTransitions = ORDER_STATE_TRANSITIONS.filter(t => t.from === currentStatus);
  const matchingTransition = possibleTransitions.find(
    t => t.action === targetAction && t.allowedRoles.includes(userRole)
  );

  if (matchingTransition) {
    return {
      allowed: true,
      nextStates: possibleTransitions
    };
  }

  const transitionExists = ORDER_STATE_TRANSITIONS.find(
    t => t.from === currentStatus && t.action === targetAction
  );

  if (transitionExists && !transitionExists.allowedRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `当前角色（${userRole}）不允许执行此操作`,
      nextStates: possibleTransitions
    };
  }

  return {
    allowed: false,
    reason: `无法从「${getOrderStatusName(currentStatus)}」执行此操作`,
    nextStates: possibleTransitions
  };
};

export const getOrderStatusName = (status: OrderStatus): string => {
  const names: Record<OrderStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    paid: '已支付',
    locked: '已锁价',
    checkin: '入住中',
    checkout: '已退房',
    completed: '已完成',
    cancelled: '已取消',
    partially_cancelled: '部分取消',
  };
  return names[status] || status;
};

export const getOrderStatusColor = (status: OrderStatus): string => {
  const colors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    locked: 'bg-purple-100 text-purple-800',
    checkin: 'bg-indigo-100 text-indigo-800',
    checkout: 'bg-gray-100 text-gray-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
    partially_cancelled: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const canModifyPrice = (order: Order): boolean => {
  return !order.lockedPrice && !['paid', 'locked', 'checkin', 'checkout', 'completed'].includes(order.status);
};

export const canLockPrice = (order: Order): boolean => {
  return order.status === 'paid' && !order.lockedPrice;
};

export const canRefund = (order: Order): boolean => {
  return ['paid', 'locked', 'checkin'].includes(order.status) && order.paidAmount > 0;
};

export const canReschedule = (order: Order): boolean => {
  return ['confirmed', 'paid'].includes(order.status);
};

export const canPartialCancel = (order: Order): boolean => {
  return ['paid', 'locked'].includes(order.status) && getNightsBetween(order.checkinDate, order.checkoutDate) > 1;
};

export const processOrderCancellation = (
  order: Order,
  reason: RefundReason,
  operatorId: string,
  usedBenefits?: BenefitSource[]
) => {
  const refundResult = calculateRefund(order, reason, undefined, usedBenefits);
  
  return {
    newStatus: 'cancelled' as OrderStatus,
    refund: {
      orderId: order.id,
      amount: order.paidAmount,
      reason,
      daysBeforeCheckin: refundResult.daysBeforeCheckin,
      usedBenefits: refundResult.usedBenefits,
      benefitDeduction: refundResult.benefitDeduction,
      cancelFeeRate: refundResult.cancelFeeRate,
      cancelFee: refundResult.cancelFee,
      refundAmount: refundResult.refundAmount,
      operatorId,
      createdAt: Date.now(),
    },
    calculationSteps: refundResult.calculationSteps
  };
};

export const processPartialCancellation = (
  order: Order,
  cancelledNights: number,
  reason: RefundReason,
  operatorId: string
) => {
  const totalNights = getNightsBetween(order.checkinDate, order.checkoutDate);
  const refundResult = calculatePartialRefund(order, cancelledNights, totalNights, reason);
  
  return {
    newStatus: 'partially_cancelled' as OrderStatus,
    refund: {
      orderId: order.id,
      amount: order.paidAmount * (cancelledNights / totalNights),
      reason,
      daysBeforeCheckin: refundResult.daysBeforeCheckin,
      usedBenefits: refundResult.usedBenefits,
      benefitDeduction: refundResult.benefitDeduction,
      cancelFeeRate: refundResult.cancelFeeRate,
      cancelFee: refundResult.cancelFee,
      refundAmount: refundResult.refundAmount,
      operatorId,
      createdAt: Date.now(),
    },
    calculationSteps: refundResult.calculationSteps
  };
};
