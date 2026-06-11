import { useState, useMemo } from 'react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import Calendar from '@/components/calendar/Calendar';
import { buildCalendarPrices } from '@/utils/price';
import { addDaysISO, todayISO } from '@/utils/date';

export default function HostCalendar() {
  const { rooms, holidays, discounts } = useRoomStore();
  const orders = useOrderStore((s) => s.orders);
  const maintenances = useMaintenanceStore((s) => s.maintenances);
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '');

  const room = rooms.find((r) => r.id === selectedRoomId);
  const roomOrders = orders.filter((o) =>
    o.roomId === selectedRoomId && ['paid', 'confirmed', 'checkedIn'].includes(o.status)
  );
  const roomMaintenances = maintenances.filter((m) =>
    m.roomId === selectedRoomId && m.status !== 'completed' && m.status !== 'cancelled'
  );

  const today = todayISO();
  const prices = useMemo(() => {
    if (!room) return {};
    return buildCalendarPrices(
      room,
      today,
      addDaysISO(today, 90),
      holidays,
      roomOrders.map((o) => ({ start: o.checkIn, end: o.checkOut, orderId: o.id })),
      roomMaintenances.map((m) => ({ start: m.startDate, end: m.endDate }))
    );
  }, [room, holidays, roomOrders, roomMaintenances, today]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">房态日历</h1>
        <p className="text-ink-300">查看各房间未来 90 天的房态与每日价格</p>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoomId(r.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedRoomId === r.id
                ? 'bg-gradient-to-br from-clay-300 to-clay-400 text-white shadow-soft'
                : 'bg-white text-ink-400 hover:text-ink-600 hover:bg-ink-50 border border-ink-100'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {room ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Calendar prices={prices} allowSelect={false} title={room.name} />
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-display text-lg text-ink-600 mb-4">房间信息</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-ink-300">房型</span><span className="text-ink-500 font-medium">{room.type}</span></div>
                <div className="flex justify-between"><span className="text-ink-300">床型</span><span className="text-ink-500 font-medium">{room.bedType}</span></div>
                <div className="flex justify-between"><span className="text-ink-300">平日价</span><span className="text-clay-500 font-display">¥{room.basePriceWeekday}</span></div>
                <div className="flex justify-between"><span className="text-ink-300">周末价</span><span className="text-ink-600 font-display">¥{room.basePriceWeekend}</span></div>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-display text-lg text-ink-600 mb-3">近期预订</h3>
              {roomOrders.length === 0 ? (
                <p className="text-sm text-ink-300">暂无预订</p>
              ) : (
                <div className="space-y-3">
                  {roomOrders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b border-ink-100 last:border-0">
                      <div>
                        <div className="font-medium text-ink-600">{o.guestName}</div>
                        <div className="text-xs text-ink-300">{o.checkIn} ~ {o.checkOut} · {o.nights}晚</div>
                      </div>
                      <div className="font-display text-clay-500">¥{o.finalAmount}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h3 className="font-display text-lg text-ink-600 mb-3">维修计划</h3>
              {roomMaintenances.length === 0 ? (
                <p className="text-sm text-ink-300">暂无维修</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {roomMaintenances.map((m) => (
                    <div key={m.id} className="flex items-start gap-2 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <div>
                        <div className="text-ink-600">{m.reason}</div>
                        <div className="text-xs text-ink-300">{m.startDate} ~ {m.endDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center text-ink-300">请先在房间管理中创建房间</div>
      )}
    </div>
  );
}
