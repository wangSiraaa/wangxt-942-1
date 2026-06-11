export type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'checkedIn' | 'checkedOut' | 'cancelled';
export type MaintenanceStatus = 'scheduled' | 'inProgress' | 'completed' | 'cancelled';
export type DayStatus = 'available' | 'booked' | 'maintenance' | 'selected' | 'range' | 'checkIn' | 'checkOut';
export type UserRole = 'home' | 'host' | 'ops' | 'guest';

export interface Room {
  id: string;
  name: string;
  type: string;
  bedCount: number;
  bedType: string;
  area: number;
  facilities: string[];
  image: string;
  basePriceWeekday: number;
  basePriceWeekend: number;
  description?: string;
  maxGuests: number;
}

export interface HolidayPrice {
  id: string;
  roomId: string;
  name: string;
  startDate: string;
  endDate: string;
  price: number;
}

export interface DiscountRule {
  id: string;
  roomId: string;
  minNights: number;
  discountRate: number;
}

export interface Maintenance {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: MaintenanceStatus;
  createdAt: string;
}

export interface Order {
  id: string;
  roomId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  originalAmount: number;
  discountAmount: number;
  discountRate?: number;
  discountRuleName?: string;
  finalAmount: number;
  dailyBreakdown: { date: string; price: number }[];
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelFee?: number;
  cancelFeeRate?: number;
  cancelReason?: string;
  refundAmount?: number;
  remark?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface DatePrice {
  date: string;
  price: number;
  source: 'weekday' | 'weekend' | 'holiday';
  status: DayStatus;
  maintenance?: Maintenance;
  orderId?: string;
}
