import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Users } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useUIStore } from '@/store/uiStore';
import Calendar, { PriceSummaryBar } from '@/components/calendar/Calendar';
import RoomCard from '@/components/common/RoomCard';
import { buildCalendarPrices, calculatePricing, CANCEL_RULES } from '@/utils/price';
import { todayISO, addDaysISO, diffDays, fmtDateCN } from '@/utils/date';
import type { DatePrice, Room } from '@/types';

export default function GuestHome() {
  const navigate = useNavigate();
  const { rooms, holidays, discounts } = useRoomStore();
  const orders = useOrderStore((s) => s.orders);
  const maintenances = useMaintenanceStore((s) => s.maintenances);
  const showToast = useUIStore((s) => s.showToast);

  const [roomId, setRoomId] = useState<string>(rooms[0]?.id || '');
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(2);

  const room = rooms.find((r) => r.id === roomId);
  const activeOrders = orders.filter(
    (o) => o.roomId === roomId && ['paid', 'confirmed', 'checkedIn'].includes(o.status)
  );
  const roomMaints = maintenances.filter(
    (m) => m.roomId === roomId && m.status !== 'completed' && m.status !== 'cancelled'
  );

  const today = todayISO();
  const prices = useMemo(() => {
    if (!room) return {};
    return buildCalendarPrices(
      room,
      today,
      addDaysISO(today, 90),
      holidays,
      activeOrders.map((o) => ({ start: o.checkIn, end: o.checkOut, orderId: o.id })),
      roomMaints.map((m) => ({ start: m.startDate, end: m.endDate }))
    );
  }, [room, holidays, activeOrders, roomMaints, today]);

  const pricing = useMemo(() => {
    if (!room || !checkIn || !checkOut) return null;
    return calculatePricing(room, checkIn, checkOut, holidays, discounts);
  }, [room, checkIn, checkOut, holidays, discounts]);

  const handleSelect = (date: string) => {
    if (!room) return;
    const info = prices[date];
    if (info?.status === 'maintenance') {
      return showToast({ type: 'error', message: '该日期正在维修，无法选择' });
    }
    if (info?.status === 'booked') {
      return showToast({ type: 'error', message: '该日期已被预订' });
    }
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date);
      setCheckOut(null);
    } else if (checkIn && !checkOut) {
      if (date === checkIn) {
        setCheckIn(null);
        return;
      }
      if (date < checkIn) {
        setCheckIn(date);
        return;
      }
      const nights = diffDays(checkIn, date);
      if (nights > 30) {
        return showToast({ type: 'warning', message: '单次预订最多 30 晚' });
      }
      const range = Array.from({ length: nights }, (_, i) => addDaysISO(checkIn, i));
      const blocked = range.find((d) => {
        const info = prices[d];
        return info?.status === 'booked' || info?.status === 'maintenance';
      });
      if (blocked) {
        showToast({ type: 'error', message: `所选时段包含 ${fmtDateCN(blocked)} 不可预订日期` });
        setCheckIn(date);
        setCheckOut(null);
        return;
      }
      setCheckOut(date);
      showToast({ type: 'success', message: `已选择 ${nights} 晚` });
    }
  };

  const goBook = () => {
    if (!room || !checkIn || !checkOut || !pricing) return;
    if (guestCount > room.maxGuests) {
      return showToast({ type: 'error', message: `该房间最多入住 ${room.maxGuests} 人` });
    }
    const state = {
      roomId: room.id,
      checkIn,
      checkOut,
      guestCount,
      pricing,
    };
    navigate('/guest/booking', { state });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">选择房间和日期</h1>
        <p className="text-ink-300">查看可订房态，选择入住日期，享受连住优惠</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-5">
          <div>
            <label className="label">选择房间</label>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin pr-1">
              {rooms.map((r: Room) => (
                <button
                  key={r.id}
                  onClick={() => { setRoomId(r.id); setCheckIn(null); setCheckOut(null); setGuestCount(Math.min(guestCount, r.maxGuests)); }}
                  className={`w-full text-left p-3 rounded-2xl transition-all border-2 ${
                    roomId === r.id
                      ? 'border-clay-300 bg-clay-50 shadow-card'
                      : 'border-transparent bg-white/80 hover:bg-white hover:shadow-card'
                  }`}
                >
                  <div className="flex gap-3">
                    <img src={r.image} alt={r.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink-600 truncate">{r.name}</div>
                      <div className="text-xs text-ink-300 mt-0.5">{r.bedType} · {r.area}㎡ · 最多{r.maxGuests}人</div>
                      <div className="mt-1.5">
                        <span className="font-display text-clay-500">¥{r.basePriceWeekday}</span>
                        <span className="text-xs text-ink-300">/晚起</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {room && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-ink-400" />
                <label className="text-sm font-medium text-ink-500 m-0">入住人数</label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGuestCount((v) => Math.max(1, v - 1))}
                  className="w-10 h-10 rounded-xl bg-cream-50 hover:bg-cream-100 text-ink-500 transition-colors font-display text-lg"
                >−</button>
                <div className="font-display text-2xl text-ink-600 w-12 text-center">{guestCount}</div>
                <button
                  onClick={() => setGuestCount((v) => Math.min(room.maxGuests, v + 1))}
                  className="w-10 h-10 rounded-xl bg-cream-50 hover:bg-cream-100 text-ink-500 transition-colors font-display text-lg"
                >+</button>
                <span className="text-xs text-ink-300">最多 {room.maxGuests} 人</span>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          {room ? (
            <>
              <Calendar
                prices={prices}
                selectedCheckIn={checkIn}
                selectedCheckOut={checkOut}
                onSelectDate={handleSelect}
                title={`${room.name} · 点选日期`}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pricing ? (
                  <>
                    <PriceSummaryBar
                      nights={pricing.nights}
                      original={pricing.originalAmount}
                      discount={pricing.discountAmount}
                      final={pricing.finalAmount}
                      discountName={pricing.discountRuleName}
                    />
                    <div className="card p-5">
                      <div className="text-xs text-ink-300 uppercase tracking-wide mb-2">预订信息</div>
                      <div className="space-y-1.5 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-ink-300">入住</span>
                          <span className="font-medium text-ink-600">{fmtDateCN(checkIn!)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-300">退房</span>
                          <span className="font-medium text-ink-600">{fmtDateCN(checkOut!)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-300">入住人</span>
                          <span className="font-medium text-ink-600">{guestCount} 位</span>
                        </div>
                      </div>
                      <button onClick={goBook} className="btn-primary w-full">
                        <CalendarCheck className="w-4 h-4" /> 立即预订
                      </button>
                      <p className="text-[11px] text-ink-200 mt-2.5 leading-relaxed">
                        {CANCEL_RULES.map((r) => `${r.range} ${r.desc}`).join(' · ')}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="card p-8 text-center col-span-full text-ink-300 text-sm">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-ink-200" />
                    请在日历上选择入住和退房日期
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card p-16 text-center text-ink-300">请先选择房间</div>
          )}
        </div>
      </div>
    </div>
  );
}
