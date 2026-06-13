import type { Order, Room, RevenueForecast, CalendarDayStatus } from '../types';
import { getDatesBetween, getNightsBetween, isDateInRange } from './dateUtils';

export const calculateRevenueForecast = (
  rooms: Room[],
  orders: Order[],
  startDate: string,
  endDate: string,
  getDayStatus: (roomId: string, date: string) => CalendarDayStatus | undefined
): RevenueForecast[] => {
  const dates = getDatesBetween(startDate, endDate);
  const forecast: RevenueForecast[] = [];

  for (const date of dates) {
    let expectedRevenue = 0;
    let actualRevenue = 0;
    let occupiedRooms = 0;

    for (const room of rooms) {
      const dayStatus = getDayStatus(room.id, date);
      if (dayStatus) {
        expectedRevenue += dayStatus.price;
      }

      const dayOrders = orders.filter(
        o => o.roomId === room.id && 
             isDateInRange(date, o.checkinDate, o.checkoutDate) &&
             !['cancelled', 'partially_cancelled'].includes(o.status)
      );

      if (dayOrders.length > 0) {
        occupiedRooms++;
        for (const order of dayOrders) {
          const nights = getNightsBetween(order.checkinDate, order.checkoutDate);
          const dailyRevenue = order.priceSnapshot.totalPrice / nights;
          
          if (['paid', 'locked', 'checkin', 'checkout', 'completed'].includes(order.status)) {
            actualRevenue += dailyRevenue;
          }
          if (['confirmed', 'paid', 'locked', 'checkin', 'checkout', 'completed'].includes(order.status)) {
            expectedRevenue += dailyRevenue;
          }
        }
      }
    }

    const totalRooms = rooms.length;
    const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0;
    const avgDailyRate = occupiedRooms > 0 ? actualRevenue / occupiedRooms : 0;

    forecast.push({
      date,
      expectedRevenue: Math.round(expectedRevenue * 100) / 100,
      actualRevenue: Math.round(actualRevenue * 100) / 100,
      occupiedRooms,
      totalRooms,
      occupancyRate: Math.round(occupancyRate * 10000) / 100,
      avgDailyRate: Math.round(avgDailyRate * 100) / 100,
    });
  }

  return forecast;
};

export const calculateRevenueSummary = (forecast: RevenueForecast[]) => {
  const totalExpected = forecast.reduce((sum, f) => sum + f.expectedRevenue, 0);
  const totalActual = forecast.reduce((sum, f) => sum + f.actualRevenue, 0);
  const avgOccupancy = forecast.length > 0 
    ? forecast.reduce((sum, f) => sum + f.occupancyRate, 0) / forecast.length 
    : 0;
  const avgADR = forecast.filter(f => f.occupiedRooms > 0).length > 0
    ? forecast.filter(f => f.occupiedRooms > 0).reduce((sum, f) => sum + f.avgDailyRate, 0) / 
      forecast.filter(f => f.occupiedRooms > 0).length
    : 0;

  return {
    totalExpected: Math.round(totalExpected * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    avgOccupancy: Math.round(avgOccupancy * 100) / 100,
    avgADR: Math.round(avgADR * 100) / 100,
    daysCount: forecast.length,
  };
};

export const calculateOrderRevenue = (order: Order) => {
  const nights = getNightsBetween(order.checkinDate, order.checkoutDate);
  return {
    nights,
    dailyRate: nights > 0 ? order.priceSnapshot.totalPrice / nights : 0,
    total: order.priceSnapshot.totalPrice,
    paid: order.paidAmount,
    outstanding: order.priceSnapshot.totalPrice - order.paidAmount,
  };
};

export const generateOrderNo = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${year}${month}${day}${random}`;
};

let idCounter = 0;

export const generateId = (prefix: string = ''): string => {
  idCounter += 1;
  return `${prefix}${Date.now()}_${idCounter}_${Math.random().toString(36).substring(2, 9)}`;
};
