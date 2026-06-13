export type UserRole = 'host' | 'guest' | 'operator';

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'paid' 
  | 'locked' 
  | 'checkin' 
  | 'checkout' 
  | 'completed' 
  | 'cancelled' 
  | 'partially_cancelled';

export type MaintenanceType = 'full_day' | 'half_day_morning' | 'half_day_afternoon';

export type PriceVersionStatus = 'draft' | 'active' | 'archived';

export type RefundReason = 
  | 'guest_cancel' 
  | 'host_cancel' 
  | 'maintenance' 
  | 'system' 
  | 'reschedule'
  | 'partial_cancel';

export type BenefitSource = 
  | 'coupon' 
  | 'member_discount' 
  | 'promotion' 
  | 'long_stay' 
  | 'none';

export interface Property {
  id: string;
  name: string;
  address: string;
  description: string;
  hostId: string;
  createdAt: number;
}

export interface Room {
  id: string;
  propertyId: string;
  name: string;
  roomNumber: string;
  basePrice: number;
  maxGuests: number;
  bedCount: number;
  area: number;
  amenities: string[];
  createdAt: number;
}

export interface PriceVersion {
  id: string;
  roomId: string;
  name: string;
  startDate: string;
  endDate: string;
  basePrice: number;
  weekendPremium: number;
  holidayPremium: number;
  status: PriceVersionStatus;
  createdAt: number;
  createdBy: string;
}

export interface LongStayDiscount {
  id: string;
  roomId: string;
  minNights: number;
  maxNights: number;
  discountPercent: number;
  createdAt: number;
}

export interface HolidayPrice {
  id: string;
  roomId: string;
  date: string;
  price: number;
  reason: string;
  createdAt: number;
}

export interface MaintenanceRecord {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  type: MaintenanceType;
  reason: string;
  operatorId: string;
  createdAt: number;
}

export interface LockRecord {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  reason: string;
  lockedBy: string;
  createdAt: number;
  releasedAt?: number;
  releasedBy?: string;
}

export interface ReleaseRecord {
  id: string;
  roomId: string;
  date: string;
  reason: string;
  operatorId: string;
  createdAt: number;
}

export interface OrderPriceSnapshot {
  basePrice: number;
  holidayPremium: number;
  weekendPremium: number;
  longStayDiscount: number;
  otherDiscounts: number;
  totalPrice: number;
  benefitSource: BenefitSource;
  benefitAmount: number;
}

export interface Order {
  id: string;
  orderNo: string;
  roomId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  checkinDate: string;
  checkoutDate: string;
  actualCheckin?: string;
  actualCheckout?: string;
  guestCount: number;
  priceSnapshot: OrderPriceSnapshot;
  paidAmount: number;
  status: OrderStatus;
  lockedPrice: boolean;
  createdAt: number;
  updatedAt: number;
  parentOrderId?: string;
  rescheduledFrom?: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  amount: number;
  reason: RefundReason;
  daysBeforeCheckin: number;
  usedBenefits: BenefitSource[];
  benefitDeduction: number;
  cancelFeeRate: number;
  cancelFee: number;
  refundAmount: number;
  operatorId: string;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: any;
  newValue: any;
  operatorId: string;
  operatorRole: UserRole;
  createdAt: number;
}

export type EventType = 
  | 'PROPERTY_CREATED'
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'PRICE_VERSION_CREATED'
  | 'PRICE_VERSION_ACTIVATED'
  | 'PRICE_VERSION_ARCHIVED'
  | 'HOLIDAY_PRICE_SET'
  | 'LONG_STAY_DISCOUNT_SET'
  | 'MAINTENANCE_CREATED'
  | 'MAINTENANCE_CANCELLED'
  | 'LOCK_CREATED'
  | 'LOCK_RELEASED'
  | 'RELEASE_CREATED'
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PAID'
  | 'ORDER_LOCKED'
  | 'ORDER_CHECKIN'
  | 'ORDER_CHECKOUT'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_PARTIALLY_CANCELLED'
  | 'ORDER_RESCHEDULED'
  | 'ORDER_PRICE_RECALCULATED'
  | 'REFUND_CREATED'
  | 'BATCH_PRICE_UPDATED';

export interface DomainEvent {
  id: string;
  type: EventType;
  payload: any;
  timestamp: number;
  operatorId: string;
  operatorRole: UserRole;
}

export interface CalendarDayStatus {
  date: string;
  roomId: string;
  available: boolean;
  availableUnits: number;
  price: number;
  basePrice: number;
  isHoliday: boolean;
  isWeekend: boolean;
  maintenanceType?: MaintenanceType;
  isLocked: boolean;
  isReleased: boolean;
  orderIds: string[];
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  type: 'maintenance_order' | 'lock_order' | 'order_overlap';
  severity: 'error' | 'warning';
  message: string;
  entityIds: string[];
}

export interface PriceCalculationResult {
  basePrice: number;
  holidayPremium: number;
  weekendPremium: number;
  longStayDiscount: number;
  otherDiscounts: number;
  subtotal: number;
  benefitSource: BenefitSource;
  benefitAmount: number;
  totalPrice: number;
  dailyBreakdown: { date: string; price: number }[];
}

export interface RefundCalculationResult {
  daysBeforeCheckin: number;
  paidAmount: number;
  usedBenefits: BenefitSource[];
  benefitDeduction: number;
  cancelFeeRate: number;
  cancelFee: number;
  refundAmount: number;
  calculationSteps: string[];
}

export interface RevenueForecast {
  date: string;
  expectedRevenue: number;
  actualRevenue: number;
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  avgDailyRate: number;
}
