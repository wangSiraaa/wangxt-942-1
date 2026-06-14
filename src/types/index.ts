export type UserRole = 'host' | 'guest' | 'operator';

export type ChannelType = 'direct' | 'ota' | 'corporate_longstay' | 'event_buyout';

export type SaleStatus = 'available' | 'limited' | 'unavailable';

export type PricingSuggestionType = 'raise' | 'lower' | 'hold' | 'restrict';

export type ExceptionType = 
  | 'channel_oversell' 
  | 'maintenance_extended' 
  | 'cleaning_incomplete' 
  | 'refund_failed'
  | 'price_conflict'
  | 'inventory_conflict';

export type ExceptionSeverity = 'critical' | 'warning' | 'info';

export type ExceptionStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export type AuditActionCategory = 
  | 'inventory' 
  | 'pricing' 
  | 'order' 
  | 'channel' 
  | 'maintenance' 
  | 'exception' 
  | 'system';

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

export interface ChannelConfig {
  id: string;
  roomId: string;
  channel: ChannelType;
  channelName: string;
  enabled: boolean;
  totalInventory: number;
  reservedInventory: number;
  minPrice?: number;
  maxPrice?: number;
  oversellThreshold: number;
  commissionRate: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelInventorySnapshot {
  date: string;
  roomId: string;
  channel: ChannelType;
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  oversoldUnits: number;
}

export interface PricingFactor {
  factor: 'holiday' | 'weekend' | 'maintenance_risk' | 'cleaning_capacity' | 'historical_occupancy' | 'competitor_price' | 'demand_forecast';
  weight: number;
  value: number;
  description: string;
}

export interface PricingSuggestion {
  id: string;
  roomId: string;
  date: string;
  currentPrice: number;
  suggestedPrice: number;
  suggestionType: PricingSuggestionType;
  adjustmentPercent: number;
  confidenceScore: number;
  factors: PricingFactor[];
  rationale: string;
  createdAt: number;
  appliedAt?: number;
  appliedBy?: string;
  status: 'pending' | 'applied' | 'rejected' | 'expired';
}

export interface AvailabilityExplanation {
  saleStatus: SaleStatus;
  primaryReason: string;
  detailedReasons: string[];
  factors: {
    maintenance: boolean;
    locked: boolean;
    soldOut: boolean;
    channelRestricted: boolean;
    inventoryExhausted: boolean;
    cleaningPending: boolean;
    oversellRisk: boolean;
  };
  availableInventory: number;
  totalInventory: number;
  conflictingOrders?: string[];
  conflictingMaintenances?: string[];
  conflictingLocks?: string[];
}

export interface RescheduleValidationResult {
  allowed: boolean;
  priceChanged: boolean;
  oldPrice: number;
  newPrice: number;
  priceDiff: number;
  lockPriceViolation: boolean;
  benefitsStillValid: boolean;
  expiredBenefits: BenefitSource[];
  refundRequired: boolean;
  refundAmount: number;
  additionalPayment: number;
  cancellationFees: number;
  conflicts: string[];
  newAvailabilityAvailable: boolean;
}

export interface PartialCancelValidationResult {
  allowed: boolean;
  refundAmount: number;
  cancelFee: number;
  benefitDeduction: number;
  remainingNights: number;
  cancelledNights: number;
  remainingPrice: number;
  priceLocked: boolean;
  conflicts: string[];
}

export interface BatchPriceProtectionResult {
  totalAffectedDates: number;
  protectedDates: number;
  updatedDates: number;
  skippedOrders: Array<{
    orderId: string;
    orderNo: string;
    lockedPrice: number;
    wouldBePrice: number;
    diff: number;
  }>;
  updatedHolidayPrices: Array<{
    roomId: string;
    date: string;
    oldPrice: number;
    newPrice: number;
  }>;
}

export interface ExceptionQueueItem {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  description: string;
  roomId?: string;
  orderId?: string;
  channel?: ChannelType;
  date?: string;
  metadata: Record<string, any>;
  assigneeId?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolution?: string;
  auditTrail: Array<{
    timestamp: number;
    operatorId: string;
    action: string;
    note?: string;
  }>;
}

export interface DetailedAuditLog extends AuditLog {
  category: AuditActionCategory;
  channel?: ChannelType;
  roomId?: string;
  orderId?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeState?: any;
  afterState?: any;
  changeSummary: string;
  relatedEntityIds?: string[];
}

export interface HistoricalOccupancyRecord {
  date: string;
  roomId: string;
  occupancyRate: number;
  avgDailyRate: number;
  revenue: number;
  channel: ChannelType;
}

export interface CleaningSchedule {
  id: string;
  roomId: string;
  date: string;
  scheduledTime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assigneeId?: string;
  completedAt?: number;
  notes?: string;
}

export interface OrderChannelInfo {
  orderId: string;
  channel: ChannelType;
  channelOrderId?: string;
  commissionAmount: number;
  channelData?: Record<string, any>;
}
