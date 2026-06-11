import type { Room, HolidayPrice, DiscountRule, Maintenance, Order } from '@/types';
import { toISO, addDaysISO, todayISO } from './date';

const genId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const today = todayISO();

export const seedRooms: Room[] = [
  {
    id: 'room_001',
    name: '山茶·山景大床房',
    type: '大床房',
    bedCount: 1,
    bedType: '1.8m 大床',
    area: 28,
    maxGuests: 2,
    facilities: ['独立卫浴', '空调', '免费WiFi', '山景阳台', '智能电视', '迷你吧'],
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=70',
    basePriceWeekday: 488,
    basePriceWeekend: 688,
    description: '面向山林的独立阳台，清晨被鸟鸣唤醒，原木家具搭配暖色调布艺，是远离城市喧嚣的理想栖居。',
  },
  {
    id: 'room_002',
    name: '松烟·庭院双床房',
    type: '双床房',
    bedCount: 2,
    bedType: '1.2m 双床',
    area: 32,
    maxGuests: 3,
    facilities: ['独立卫浴', '空调', '免费WiFi', '私家庭院', '智能电视', '茶台茶具'],
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=70',
    basePriceWeekday: 588,
    basePriceWeekend: 828,
    description: '推开窗即是私家小院，竹影婆娑间置有茶台，适合好友小聚或一家三口出行。',
  },
  {
    id: 'room_003',
    name: '青禾·家庭套房',
    type: '家庭套房',
    bedCount: 2,
    bedType: '1.8m + 1.2m',
    area: 48,
    maxGuests: 4,
    facilities: ['独立卫浴×2', '空调', '免费WiFi', '客厅', '智能电视', '儿童用品', '浴缸'],
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=70',
    basePriceWeekday: 888,
    basePriceWeekend: 1288,
    description: '两居室家庭套房，客厅宽敞明亮，配备儿童玩具和浴缸，是家庭出游的完美选择。',
  },
];

export const seedHolidays: HolidayPrice[] = [
  {
    id: 'hol_001',
    roomId: 'room_001',
    name: '暑期旺季',
    startDate: addDaysISO(today, 30),
    endDate: addDaysISO(today, 60),
    price: 788,
  },
  {
    id: 'hol_002',
    roomId: 'room_002',
    name: '暑期旺季',
    startDate: addDaysISO(today, 30),
    endDate: addDaysISO(today, 60),
    price: 988,
  },
  {
    id: 'hol_003',
    roomId: 'room_003',
    name: '暑期旺季',
    startDate: addDaysISO(today, 30),
    endDate: addDaysISO(today, 60),
    price: 1488,
  },
];

export const seedDiscounts: DiscountRule[] = [
  { id: 'dsc_001', roomId: 'room_001', minNights: 3, discountRate: 0.95 },
  { id: 'dsc_002', roomId: 'room_001', minNights: 7, discountRate: 0.88 },
  { id: 'dsc_003', roomId: 'room_002', minNights: 3, discountRate: 0.95 },
  { id: 'dsc_004', roomId: 'room_002', minNights: 7, discountRate: 0.88 },
  { id: 'dsc_005', roomId: 'room_003', minNights: 3, discountRate: 0.92 },
  { id: 'dsc_006', roomId: 'room_003', minNights: 7, discountRate: 0.85 },
];

export const seedMaintenances: Maintenance[] = [
  {
    id: 'mt_001',
    roomId: 'room_001',
    startDate: addDaysISO(today, 5),
    endDate: addDaysISO(today, 7),
    reason: '空调检修保养',
    status: 'scheduled',
    createdAt: toISO(new Date()),
  },
];

export const seedOrders: Order[] = [
  {
    id: 'ord_001',
    roomId: 'room_002',
    guestName: '林小眠',
    guestPhone: '13800138001',
    checkIn: addDaysISO(today, 2),
    checkOut: addDaysISO(today, 4),
    nights: 2,
    guestCount: 2,
    originalAmount: 688 * 2,
    discountAmount: 0,
    discountRate: 1,
    finalAmount: 1376,
    dailyBreakdown: [
      { date: addDaysISO(today, 2), price: 688 },
      { date: addDaysISO(today, 3), price: 688 },
    ],
    status: 'paid',
    createdAt: toISO(new Date()),
    paidAt: toISO(new Date()),
  },
];

export function createId(prefix: string) {
  return genId(prefix);
}
