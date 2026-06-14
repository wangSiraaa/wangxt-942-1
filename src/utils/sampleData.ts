import { useBookingStore } from '../store/bookingStore';
import { addDays, getToday } from '../utils/dateUtils';
import type { MaintenanceType, BenefitSource, ChannelType, ExceptionType, PricingSuggestionType } from '../types';

export const initializeSampleData = () => {
  let store = useBookingStore.getState();
  
  if (store.rooms.length > 10) {
    store.resetAllData();
    store = useBookingStore.getState();
  }
  
  if (store.events.length > 0) {
    return;
  }
  
  store = useBookingStore.getState();
  
  const property = store.createProperty({
    name: '云栖民宿',
    address: '杭州市西湖区龙井路168号',
    description: '位于西湖风景区的精品民宿，共有5间客房，环境优雅，交通便利。',
    hostId: 'user_1',
  });
  
  store.setCurrentPropertyId(property.id);
  
  const roomsData = [
    { name: '山景大床房', roomNumber: '101', basePrice: 398, maxGuests: 2, bedCount: 1, area: 28, amenities: ['独立卫浴', '空调', '电视', 'WiFi', '山景阳台'] },
    { name: '湖景双床房', roomNumber: '102', basePrice: 458, maxGuests: 3, bedCount: 2, area: 32, amenities: ['独立卫浴', '空调', '电视', 'WiFi', '湖景窗'] },
    { name: '豪华家庭房', roomNumber: '201', basePrice: 688, maxGuests: 4, bedCount: 2, area: 45, amenities: ['独立卫浴', '空调', '电视', 'WiFi', '浴缸', '阳台'] },
    { name: '精品套房', roomNumber: '202', basePrice: 888, maxGuests: 2, bedCount: 1, area: 55, amenities: ['独立卫浴', '空调', '电视', 'WiFi', '浴缸', '客厅', '阳台'] },
    { name: '多人宿舍', roomNumber: '301', basePrice: 158, maxGuests: 6, bedCount: 3, area: 40, amenities: ['公共卫浴', '空调', 'WiFi', '储物柜'] },
  ];
  
  const rooms = roomsData.map(data => 
    store.createRoom({ ...data, propertyId: property.id })
  );
  
  store.setSelectedRoomIds(rooms.map(r => r.id));
  
  const today = getToday();
  const threeMonthsLater = addDays(today, 90);
  
  for (const room of rooms) {
    store.createPriceVersion({
      roomId: room.id,
      name: '2026年夏季价格',
      startDate: today,
      endDate: threeMonthsLater,
      basePrice: room.basePrice,
      weekendPremium: 0.2,
      holidayPremium: 0.5,
      status: 'active',
      createdBy: 'user_1',
    });
    
    store.setLongStayDiscount({
      roomId: room.id,
      minNights: 3,
      maxNights: 7,
      discountPercent: 10,
    });
    
    store.setLongStayDiscount({
      roomId: room.id,
      minNights: 7,
      maxNights: 30,
      discountPercent: 15,
    });
    
    store.setLongStayDiscount({
      roomId: room.id,
      minNights: 30,
      maxNights: 365,
      discountPercent: 25,
    });
  }
  
  const holidayDates = [
    addDays(today, 10),
    addDays(today, 11),
    addDays(today, 12),
  ];
  
  for (const room of rooms) {
    for (const date of holidayDates) {
      store.setHolidayPrice({
        roomId: room.id,
        date,
        price: Math.round(room.basePrice * 1.5),
        reason: '节假日溢价',
      });
    }
  }
  
  store.createMaintenance({
    roomId: rooms[0].id,
    startDate: addDays(today, 3),
    endDate: addDays(today, 4),
    type: 'full_day',
    reason: '卫生间维修',
    operatorId: 'user_3',
  });
  
  store.createMaintenance({
    roomId: rooms[1].id,
    startDate: addDays(today, 5),
    endDate: addDays(today, 5),
    type: 'half_day_morning',
    reason: '空调检修',
    operatorId: 'user_3',
  });
  
  store.createLock({
    roomId: rooms[2].id,
    startDate: addDays(today, 7),
    endDate: addDays(today, 9),
    reason: '房东自用',
    lockedBy: 'user_1',
  });
  
  store.createRelease({
    roomId: rooms[2].id,
    date: addDays(today, 8),
    reason: '临时放量',
    operatorId: 'user_3',
  });
  
  const guestIds = ['guest_1', 'guest_2', 'guest_3', 'guest_4'];
  const guestNames = ['张三', '李四', '王五', '赵六'];
  const guestPhones = ['13800138001', '13800138002', '13800138003', '13800138004'];
  
  const bookings = [
    { roomIdx: 0, checkinOffset: 1, checkoutOffset: 3, guestIdx: 0, status: 'completed' as const, paid: true },
    { roomIdx: 1, checkinOffset: 2, checkoutOffset: 5, guestIdx: 1, status: 'paid' as const, paid: true },
    { roomIdx: 2, checkinOffset: 4, checkoutOffset: 6, guestIdx: 2, status: 'confirmed' as const, paid: false },
    { roomIdx: 3, checkinOffset: 6, checkoutOffset: 10, guestIdx: 3, status: 'paid' as const, paid: true },
    { roomIdx: 0, checkinOffset: 8, checkoutOffset: 11, guestIdx: 1, status: 'pending' as const, paid: false },
    { roomIdx: 4, checkinOffset: 1, checkoutOffset: 4, guestIdx: 2, status: 'checkin' as const, paid: true },
  ];
  
  for (const booking of bookings) {
    const room = rooms[booking.roomIdx];
    const checkin = addDays(today, booking.checkinOffset);
    const checkout = addDays(today, booking.checkoutOffset);
    
    const priceCalc = store.calculatePriceForBooking(room.id, checkin, checkout)!;
    
    const channelsForBookings: ChannelType[] = ['direct', 'ota', 'corporate_longstay', 'direct', 'ota', 'event_buyout'];
    const orderChannel = channelsForBookings[bookings.indexOf(booking)];
    
    const order = store.createOrder({
      roomId: room.id,
      guestId: guestIds[booking.guestIdx],
      guestName: guestNames[booking.guestIdx],
      guestPhone: guestPhones[booking.guestIdx],
      checkinDate: checkin,
      checkoutDate: checkout,
      guestCount: 2,
      priceSnapshot: {
        basePrice: priceCalc.basePrice,
        holidayPremium: priceCalc.holidayPremium,
        weekendPremium: priceCalc.weekendPremium,
        longStayDiscount: priceCalc.longStayDiscount,
        otherDiscounts: priceCalc.otherDiscounts,
        totalPrice: priceCalc.totalPrice,
        benefitSource: 'none' as BenefitSource,
        benefitAmount: 0,
      },
      paidAmount: booking.paid ? priceCalc.totalPrice : 0,
      channel: orderChannel,
    });
    
    if (booking.status !== 'pending') {
      store.updateOrderStatus(order.id, booking.status);
    }
    
    if (booking.status === 'paid' || booking.status === 'checkin' || booking.status === 'completed') {
      store.payOrder(order.id, priceCalc.totalPrice);
    }
    
    if (booking.status === 'completed') {
      store.updateOrderStatus(order.id, 'checkin');
      store.updateOrderStatus(order.id, 'checkout');
      store.updateOrderStatus(order.id, 'completed');
    }
  }
  
  for (const room of rooms) {
    store.initDefaultChannelConfigs(room.id);
    store.createOrUpdateChannelConfig(room.id, 'ota', {
      channelName: '携程/美团OTA',
      enabled: true,
      totalInventory: 1,
      reservedInventory: 0,
      minPrice: Math.round(room.basePrice * 0.9),
      maxPrice: Math.round(room.basePrice * 2.5),
      oversellThreshold: 0,
      commissionRate: 0.15,
    });
    store.createOrUpdateChannelConfig(room.id, 'corporate_longstay', {
      channelName: '企业长租协议',
      enabled: true,
      totalInventory: 2,
      reservedInventory: 1,
      minPrice: Math.round(room.basePrice * 0.7),
      maxPrice: Math.round(room.basePrice * 1.2),
      oversellThreshold: 0,
      commissionRate: 0.05,
    });
    store.createOrUpdateChannelConfig(room.id, 'event_buyout', {
      channelName: '临时包栋/团建',
      enabled: true,
      totalInventory: rooms.length,
      reservedInventory: 0,
      minPrice: Math.round(room.basePrice * 1.5),
      maxPrice: Math.round(room.basePrice * 4),
      oversellThreshold: 0,
      commissionRate: 0.08,
    });
  }
  
  store.generateHistoricalData(90);
  store.generateCleaningSchedulesForRange(addDays(today, -3), addDays(today, 14));
  
  const firstOrder = store.orders[0];
  if (firstOrder) {
    store.assignOrderChannel(firstOrder.id, 'ota', 'OTA20260115001', Math.round(firstOrder.priceSnapshot.totalPrice * 0.15));
  }
  const secondOrder = store.orders[2];
  if (secondOrder) {
    store.assignOrderChannel(secondOrder.id, 'corporate_longstay', 'CORP202601001', Math.round(secondOrder.priceSnapshot.totalPrice * 0.05));
  }
  
  try {
    store.generatePricingSuggestions(rooms.map(r => r.id), addDays(today, 1), addDays(today, 30));
  } catch (e) {
    console.log('调价建议生成跳过:', e);
  }
  
  try {
    store.runExceptionDetection();
  } catch (e) {
    console.log('异常检测跳过:', e);
  }
  
  store.replayEvents();
  store.rebuildCalendar();
};
