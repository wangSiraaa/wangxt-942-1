import { useEffect } from 'react';
import { Home, Building2, Wrench, User, ArrowLeft, Settings, Calendar, CalendarRange } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import type { UserRole } from '@/types';
import { useNavigate, useLocation } from 'react-router-dom';

type LayoutRole = Exclude<UserRole, 'home'>;

const roleConfig: Record<LayoutRole, { label: string; color: string; Icon: any }> = {
  host: { label: '房东端', color: 'from-clay-300 to-clay-400', Icon: Building2 },
  ops: { label: '运营端', color: 'from-ink-500 to-ink-600', Icon: Wrench },
  guest: { label: '住客端', color: 'from-sage-300 to-sage-500', Icon: User },
};

const roleNav: Record<LayoutRole, { label: string; to: string; Icon: any }[]> = {
  host: [
    { label: '概览', to: '/host', Icon: Home },
    { label: '房间管理', to: '/host/rooms', Icon: Building2 },
    { label: '价格策略', to: '/host/pricing', Icon: Settings },
    { label: '房态日历', to: '/host/calendar', Icon: Calendar },
    { label: '订单列表', to: '/host/orders', Icon: CalendarRange },
  ],
  ops: [
    { label: '概览', to: '/ops', Icon: Home },
    { label: '维修管理', to: '/ops/maintenance', Icon: Wrench },
    { label: '订单管控', to: '/ops/orders', Icon: CalendarRange },
  ],
  guest: [
    { label: '房态预订', to: '/guest', Icon: Home },
    { label: '我的订单', to: '/guest/orders', Icon: CalendarRange },
  ],
};

interface LayoutProps {
  children: React.ReactNode;
  role?: LayoutRole;
}

export default function Layout({ children, role }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole, setCurrentRole } = useUIStore();

  useEffect(() => {
    if (role && role !== currentRole) {
      setCurrentRole(role);
    }
  }, [role, currentRole, setCurrentRole]);

  const effectiveRole = (role || currentRole) as LayoutRole;

  if (!effectiveRole || !roleConfig[effectiveRole]) {
    return <div className="min-h-screen">{children}</div>;
  }

  const cfg = roleConfig[effectiveRole];
  const Icon = cfg.Icon;
  const nav = roleNav[effectiveRole];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-white/70 backdrop-blur border-r border-ink-100 flex flex-col">
        <div className={`px-6 py-5 bg-gradient-to-br ${cfg.color}`}>
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-lg leading-tight">{cfg.label}</div>
              <div className="text-xs opacity-80">民宿房态价历</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== `/${effectiveRole}` && location.pathname.startsWith(item.to));
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-clay-50 text-clay-500 shadow-sm'
                    : 'text-ink-400 hover:text-ink-600 hover:bg-ink-50'
                }`}
              >
                <item.Icon className="w-4.5 h-4.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-ink-100">
          <button
            onClick={() => {
              setCurrentRole('home');
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-ink-400 hover:text-clay-500 hover:bg-clay-50 transition-all"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
            返回角色选择
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="px-8 py-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
