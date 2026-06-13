import { useEffect, useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { initializeSampleData } from '../utils/sampleData';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import PriceDetailPanel from '../components/PriceDetailPanel';
import OrderManagement from '../components/OrderManagement';
import DataPanels from '../components/DataPanels';
import CalendarIO from '../components/CalendarIO';
import type { UserRole } from '../types';
import { Home as HomeIcon, Users, Settings, Building2, Calendar as CalendarIcon, FileText, BarChart3, Database } from 'lucide-react';

export default function Home() {
  const { 
    currentRole, setCurrentRole, 
    currentUserId, setCurrentUserId,
    properties, rooms, orders,
    resetAllData, replayEvents
  } = useBookingStore();
  
  const [activeView, setActiveView] = useState<'calendar' | 'orders' | 'analysis' | 'io'>('calendar');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      initializeSampleData();
      setIsInitialized(true);
    };
    init();
  }, []);

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    const userIds: Record<UserRole, string> = {
      host: 'user_1',
      operator: 'user_3',
      guest: 'guest_1',
    };
    setCurrentUserId(userIds[role]);
  };

  const roleInfo: Record<UserRole, { name: string; icon: typeof Users; color: string; description: string }> = {
    host: { 
      name: '房东', 
      icon: Building2, 
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      description: '管理房间、设置价格、处理订单'
    },
    operator: { 
      name: '运营人员', 
      icon: Settings, 
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      description: '标记维修、临时放量、审核订单'
    },
    guest: { 
      name: '住客', 
      icon: Users, 
      color: 'text-green-600 bg-green-50 border-green-200',
      description: '查看房态、预订房间、管理订单'
    },
  };

  const currentProperty = properties[0];

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">正在加载示例数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <HomeIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">民宿房态价历系统</h1>
                  <p className="text-xs text-gray-500">
                    {currentProperty?.name} · {rooms.length} 间客房
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                {(['host', 'operator', 'guest'] as UserRole[]).map(role => {
                  const info = roleInfo[role];
                  const Icon = info.icon;
                  return (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all ${
                        currentRole === role
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {info.name}
                    </button>
                  );
                })}
              </div>

              <div className={`px-3 py-1.5 rounded-lg text-sm border ${roleInfo[currentRole].color}`}>
                <div className="font-medium">{roleInfo[currentRole].name}视角</div>
                <div className="text-xs opacity-75">{roleInfo[currentRole].description}</div>
              </div>

              <button
                onClick={() => {
                  if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
                    resetAllData();
                    setTimeout(() => initializeSampleData(), 100);
                  }
                }}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
              >
                重置数据
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                activeView === 'calendar'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              房态日历
            </button>
            <button
              onClick={() => setActiveView('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                activeView === 'orders'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              订单管理
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveView('analysis')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                activeView === 'analysis'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              数据分析
            </button>
            <button
              onClick={() => setActiveView('io')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                activeView === 'io'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Database className="w-4 h-4" />
              数据导入导出
            </button>

            <div className="flex-1" />

            <div className="text-sm text-gray-500">
              订单总数：<span className="font-medium text-gray-900">{orders.length}</span>
              <span className="mx-2">·</span>
              活跃订单：<span className="font-medium text-blue-600">
                {orders.filter(o => !['cancelled', 'completed'].includes(o.status)).length}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {activeView === 'calendar' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <AvailabilityCalendar />
              <DataPanels />
            </div>
            <div className="space-y-6">
              <PriceDetailPanel />
            </div>
          </div>
        )}

        {activeView === 'orders' && (
          <OrderManagement />
        )}

        {activeView === 'analysis' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <DataPanels />
            </div>
            <div className="space-y-6">
              <PriceDetailPanel />
            </div>
          </div>
        )}

        {activeView === 'io' && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <CalendarIO />
            </div>
            <div>
              <DataPanels />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-8 py-4">
        <div className="max-w-[1600px] mx-auto px-4 text-center text-sm text-gray-500">
          <p>民宿房态价历系统 · 所有数据保存在浏览器本地存储</p>
          <p className="mt-1 text-xs text-gray-400">
            支持多房间多日期管理、维修标记、节假日价格、连住折扣、订单状态机、退款分层计算
          </p>
        </div>
      </footer>
    </div>
  );
}
