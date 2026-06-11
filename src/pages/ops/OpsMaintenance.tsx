import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Wrench, AlertTriangle } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useUIStore } from '@/store/uiStore';
import Calendar from '@/components/calendar/Calendar';
import Modal from '@/components/common/Modal';
import { StatusBadge } from '@/components/calendar/Calendar';
import { buildCalendarPrices } from '@/utils/price';
import { rangesOverlap, todayISO, addDaysISO } from '@/utils/date';
import type { Maintenance, DatePrice } from '@/types';

export default function OpsMaintenance() {
  const { rooms, holidays } = useRoomStore();
  const orders = useOrderStore((s) => s.orders);
  const { maintenances, addMaintenance, updateMaintenance, deleteMaintenance } = useMaintenanceStore();
  const showToast = useUIStore((s) => s.showToast);

  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [form, setForm] = useState({ roomId: '', startDate: '', endDate: '', reason: '' });

  const room = rooms.find((r) => r.id === selectedRoomId);
  const roomOrders = orders.filter((o) =>
    o.roomId === selectedRoomId && ['paid', 'confirmed', 'checkedIn'].includes(o.status)
  );
  const roomMaints = maintenances.filter((m) => m.roomId === selectedRoomId).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const today = todayISO();
  const prices = useMemo(() => {
    if (!room) return {};
    return buildCalendarPrices(
      room,
      today,
      addDaysISO(today, 90),
      holidays,
      roomOrders.map((o) => ({ start: o.checkIn, end: o.checkOut, orderId: o.id })),
      maintenances.filter((m) => m.roomId === selectedRoomId && m.status !== 'completed' && m.status !== 'cancelled').map((m) => ({ start: m.startDate, end: m.endDate }))
    );
  }, [room, holidays, roomOrders, maintenances, selectedRoomId, today]);

  const open = (m?: Maintenance) => {
    if (m) {
      setEditing(m);
      setForm({ roomId: m.roomId, startDate: m.startDate, endDate: m.endDate, reason: m.reason });
    } else {
      setEditing(null);
      setForm({ roomId: selectedRoomId, startDate: '', endDate: '', reason: '' });
    }
    setModal(true);
  };

  const save = () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      return showToast({ type: 'error', message: '请完整填写维修信息' });
    }
    if (form.endDate < form.startDate) {
      return showToast({ type: 'error', message: '结束日期不能早于开始日期' });
    }
    const conflict = roomOrders.some((o) => rangesOverlap(form.startDate, addDaysISO(form.endDate, 1), o.checkIn, o.checkOut));
    if (conflict && !confirm('所选时段存在已确认订单，确定仍要标记维修吗？')) {
      return;
    }
    if (editing) {
      updateMaintenance(editing.id, { startDate: form.startDate, endDate: form.endDate, reason: form.reason });
      showToast({ type: 'success', message: '维修已更新' });
    } else {
      addMaintenance({ roomId: form.roomId, startDate: form.startDate, endDate: form.endDate, reason: form.reason });
      showToast({ type: 'success', message: '维修已标记' });
    }
    setModal(false);
  };

  const handleCellClick = (date: string, info: DatePrice) => {
    if (info.status === 'booked') {
      showToast({ type: 'warning', message: '该日期有已确认订单' });
    }
    setEditing(null);
    setForm({ roomId: selectedRoomId, startDate: date, endDate: date, reason: '' });
    setModal(true);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">维修管理</h1>
        <p className="text-ink-300">标记房间维修时段，维修日期自动锁定不可预订</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoomId(r.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedRoomId === r.id
                  ? 'bg-gradient-to-br from-ink-500 to-ink-600 text-white shadow-soft'
                  : 'bg-white text-ink-400 hover:text-ink-600 hover:bg-ink-50 border border-ink-100'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
        <button onClick={() => open()} className="btn-primary">
          <Plus className="w-4 h-4" /> 新增维修
        </button>
      </div>

      {room ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Calendar
              prices={prices}
              allowSelect={false}
              onCellClick={handleCellClick}
              title={`点击日历上的日期快速标记维修 · ${room.name}`}
            />
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-display text-lg text-ink-600 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-red-500" /> 维修记录
              </h3>
              {roomMaints.length === 0 ? (
                <p className="text-sm text-ink-300">暂无维修记录</p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
                  {roomMaints.map((m) => (
                    <div key={m.id} className="p-3 rounded-xl bg-cream-50/60 border border-ink-100">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-sm font-medium text-ink-600 leading-tight">{m.reason}</div>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="text-xs text-ink-300 mb-2">{m.startDate} 至 {m.endDate}</div>
                      {m.status !== 'completed' && m.status !== 'cancelled' && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => open(m)} className="btn-ghost btn-sm"><Pencil className="w-3 h-3" /> 编辑</button>
                          <button
                            onClick={() => {
                              if (confirm('取消该维修？')) {
                                updateMaintenance(m.id, { status: 'cancelled' });
                                showToast({ type: 'info', message: '已取消维修' });
                              }
                            }}
                            className="btn-ghost btn-sm text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" /> 取消
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-5 bg-amber-50/60 border-amber-100">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 leading-relaxed">
                  <div className="font-semibold mb-1">维修冲突提示</div>
                  标记的维修时段若与已确认订单重叠，需确认后才会保存；维修中的房间将不可被预订。
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center text-ink-300">请先创建房间</div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? '编辑维修' : '新增维修'}
        footer={
          <>
            <button onClick={() => setModal(false)} className="btn-ghost">取消</button>
            <button onClick={save} className="btn-primary">{editing ? '保存' : '标记维修'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">房间</label>
            <select
              className="input"
              value={form.roomId}
              onChange={(e) => setForm({ ...form, roomId: e.target.value })}
            >
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">开始日期</label>
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">结束日期</label>
              <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">维修原因</label>
            <textarea className="input min-h-[84px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="如：空调检修、水管维修、深度清洁..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
