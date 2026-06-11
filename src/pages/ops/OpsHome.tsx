import { useNavigate } from 'react-router-dom';
import { Wrench, ClipboardList, CalendarDays, TrendingUp } from 'lucide-react';
import { useOrderStore } from '@/store/orderStore';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { todayISO } from '@/utils/date';

export default function OpsHome() {
  const navigate = useNavigate();
  const orders = useOrderStore((s) => s.orders);
  const maintenances = useMaintenanceStore((s) => s.maintenances);

  const today = todayISO();
  const todayCheckIns = orders.filter((o) => o.checkIn === today && ['paid', 'confirmed'].includes(o.status));
  const todayCheckOuts = orders.filter((o) => o.checkOut === today && o.status === 'checkedIn');
  const activeMaint = maintenances.filter((m) => m.startDate <= today && m.endDate >= today && m.status !== 'completed' && m.status !== 'cancelled');
  const pendingMaint = maintenances.filter((m) => m.startDate > today && m.status === 'scheduled');

  const stats = [
    { label: '今日入住', value: todayCheckIns.length, Icon: CalendarDays, color: 'text-sage-500', bg: 'bg-sage-100' },
    { label: '今日退房', value: todayCheckOuts.length, Icon: TrendingUp, color: 'text-ink-500', bg: 'bg-ink-50' },
    { label: '进行中维修', value: activeMaint.length, Icon: Wrench, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '待执行维修', value: pendingMaint.length, Icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const shortcuts = [
    { label: '维修管理', Icon: Wrench, to: '/ops/maintenance', desc: '标记维修时段、查看维修记录' },
    { label: '订单管控', Icon: ClipboardList, to: '/ops/orders', desc: '查看、变更订单状态' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">运营工作台</h1>
        <p className="text-ink-300">调度维修、管控订单状态，保障运营效率</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {shortcuts.map((s) => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="card-hover p-5 text-left flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-ink-500 to-ink-600 flex items-center justify-center shrink-0">
              <s.Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-ink-600 mb-1">{s.label}</div>
              <div className="text-xs text-ink-300 leading-relaxed">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
