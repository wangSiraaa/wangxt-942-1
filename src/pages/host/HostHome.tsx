import { useNavigate } from 'react-router-dom';
import { Building2, Settings, CalendarDays, ClipboardList, BedDouble, TrendingUp, CalendarCheck, X } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { todayISO } from '@/utils/date';
import RoomCard from '@/components/common/RoomCard';

export default function HostHome() {
  const navigate = useNavigate();
  const rooms = useRoomStore((s) => s.rooms);
  const orders = useOrderStore((s) => s.orders);
  const maintenances = useMaintenanceStore((s) => s.maintenances);

  const today = todayISO();
  const activeOrders = orders.filter(
    (o) => ['paid', 'confirmed', 'checkedIn'].includes(o.status) && o.checkOut >= today
  );
  const revenue = orders
    .filter((o) => ['paid', 'confirmed', 'checkedIn', 'checkedOut'].includes(o.status))
    .reduce((sum, o) => sum + o.finalAmount, 0);

  const stats = [
    { label: '房间数量', value: rooms.length, Icon: BedDouble, color: 'text-clay-500', bg: 'bg-clay-50' },
    { label: '今日在住', value: activeOrders.filter((o) => o.checkIn <= today && o.checkOut > today).length, Icon: CalendarCheck, color: 'text-sage-500', bg: 'bg-sage-100' },
    { label: '累计收入', value: `¥${revenue.toLocaleString()}`, Icon: TrendingUp, color: 'text-ink-600', bg: 'bg-ink-50' },
    { label: '待处理维修', value: maintenances.filter((m) => m.status === 'scheduled' || m.status === 'inProgress').length, Icon: X, color: 'text-red-500', bg: 'bg-red-50' },
  ];

  const shortcuts = [
    { label: '房间管理', Icon: Building2, to: '/host/rooms', desc: '新增、编辑房间档案' },
    { label: '价格策略', Icon: Settings, to: '/host/pricing', desc: '基础价、节假日、连住折扣' },
    { label: '房态日历', Icon: CalendarDays, to: '/host/calendar', desc: '查看每日房态与价格' },
    { label: '订单列表', Icon: ClipboardList, to: '/host/orders', desc: '查看全部预订订单' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">房东工作台</h1>
        <p className="text-ink-300">管理房源、定价策略，查看房态与订单</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center`}>
              <s.Icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className="text-xs text-ink-300 mb-0.5">{s.label}</div>
              <div className="font-display text-2xl text-ink-600 leading-none">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {shortcuts.map((s) => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="card-hover p-5 text-left flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-clay-100 to-clay-200 flex items-center justify-center shrink-0">
              <s.Icon className="w-5 h-5 text-clay-500" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-ink-600 mb-1">{s.label}</div>
              <div className="text-xs text-ink-300 leading-relaxed">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">我的房源</h2>
        <button onClick={() => navigate('/host/rooms')} className="btn-outline btn-sm">
          查看全部
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rooms.slice(0, 3).map((r) => (
          <RoomCard key={r.id} room={r} onClick={() => navigate('/host/calendar')} />
        ))}
      </div>
    </div>
  );
}
