import { useNavigate } from 'react-router-dom';
import { Building2, Wrench, User, BedDouble, CalendarCheck, Banknote, Sparkles } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { todayISO } from '@/utils/date';

const roles = [
  {
    id: 'host' as const,
    label: '房东',
    desc: '管理房间、设置价格策略、查看订单',
    Icon: Building2,
    gradient: 'from-clay-200 via-clay-300 to-clay-400',
    shadow: 'shadow-clay-300/30',
  },
  {
    id: 'ops' as const,
    label: '运营人员',
    desc: '标记维修日期、管控订单、运营调度',
    Icon: Wrench,
    gradient: 'from-ink-400 via-ink-500 to-ink-600',
    shadow: 'shadow-ink-500/30',
  },
  {
    id: 'guest' as const,
    label: '住客',
    desc: '浏览房态价历、在线预订、管理订单',
    Icon: User,
    gradient: 'from-sage-300 via-sage-400 to-sage-500',
    shadow: 'shadow-sage-400/30',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const setRole = useUIStore((s) => s.setCurrentRole);
  const rooms = useRoomStore((s) => s.rooms);
  const orders = useOrderStore((s) => s.orders);
  const maintenances = useMaintenanceStore((s) => s.maintenances);

  const today = todayISO();
  const activeOrders = orders.filter(
    (o) => ['pending', 'paid', 'confirmed', 'checkedIn'].includes(o.status) && o.checkOut >= today
  );
  const activeMaintenances = maintenances.filter((m) => m.status !== 'completed' && m.status !== 'cancelled' && m.endDate >= today);

  const stats = [
    { label: '在管房间', value: rooms.length, Icon: BedDouble, color: 'text-clay-500', bg: 'bg-clay-50' },
    { label: '今日在住', value: activeOrders.filter((o) => o.checkIn <= today && o.checkOut > today).length, Icon: CalendarCheck, color: 'text-sage-500', bg: 'bg-sage-100' },
    { label: '维修中', value: activeMaintenances.filter((m) => m.startDate <= today).length, Icon: Wrench, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '本月订单', value: orders.length, Icon: Banknote, color: 'text-ink-500', bg: 'bg-ink-50' },
  ];

  const enter = (role: 'host' | 'ops' | 'guest') => {
    setRole(role);
    const routes = { host: '/host', ops: '/ops', guest: '/guest' };
    navigate(routes[role]);
  };

  return (
    <div className="min-h-screen px-6 py-10 md:px-10 md:py-16">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-14 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-clay-100 text-xs text-clay-500 mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            民宿房态价历 · 本地 Demo
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-ink-600 leading-tight tracking-tight mb-4">
            一屋三端，<span className="text-clay-400">尽在掌握</span>
          </h1>
          <p className="text-ink-300 text-lg max-w-xl mx-auto leading-relaxed">
            房态、价格、维修、订单实时联动。房东经营、运营调度、住客预订，
            一套日历，三种视角。
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {roles.map((r, i) => (
            <button
              key={r.id}
              onClick={() => enter(r.id)}
              className={`group relative overflow-hidden rounded-3xl p-7 text-left text-white bg-gradient-to-br ${r.gradient} shadow-lg ${r.shadow} hover:shadow-pop hover:-translate-y-1 transition-all duration-300 animate-slide-up`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-colors" />
              <r.Icon className="w-9 h-9 mb-5 relative" />
              <div className="font-display text-2xl mb-1.5 relative">{r.label}</div>
              <div className="text-sm opacity-90 mb-6 relative leading-relaxed">{r.desc}</div>
              <div className="text-sm font-medium relative flex items-center gap-1.5 opacity-90 group-hover:translate-x-1 transition-transform">
                进入{ r.label === '运营人员' ? '运营' : r.label }端
                <span aria-hidden>→</span>
              </div>
            </button>
          ))}
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

        <div className="card p-6">
          <h3 className="font-display text-lg text-ink-600 mb-4">功能亮点</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm text-ink-400">
            <div>
              <div className="font-medium text-ink-600 mb-1.5">📅 联动日历</div>
              已订、维修、可订状态一目了然，价格随规则实时计算。
            </div>
            <div>
              <div className="font-medium text-ink-600 mb-1.5">💰 灵活定价</div>
              平日/周末/节假日多档价，连住阶梯折扣，随时调整。
            </div>
            <div>
              <div className="font-medium text-ink-600 mb-1.5">🛠 维修隔离</div>
              维修时段自动锁房，订单取消按规则清晰扣费。
            </div>
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-ink-200">
          数据保存在浏览器 localStorage · 刷新不丢失 · 可随时清空浏览器缓存重置
        </footer>
      </div>
    </div>
  );
}
