import { useState } from 'react';
import { Eye, CalendarDays, User, Phone, Check, CheckSquare, LogOut } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useUIStore } from '@/store/uiStore';
import Modal from '@/components/common/Modal';
import { StatusBadge } from '@/components/calendar/Calendar';
import { fmt, CANCEL_RULES } from '@/utils/price';
import { fmtDateCN } from '@/utils/date';
import type { Order, OrderStatus } from '@/types';

const filters: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待付款' },
  { key: 'paid', label: '已付款' },
  { key: 'confirmed', label: '已确认' },
  { key: 'checkedIn', label: '已入住' },
  { key: 'checkedOut', label: '已退房' },
  { key: 'cancelled', label: '已取消' },
];

export default function OpsOrders() {
  const orders = useOrderStore((s) => s.orders);
  const rooms = useRoomStore((s) => s.rooms);
  const showToast = useUIStore((s) => s.showToast);
  const { payOrder, confirmOrder, checkInOrder, checkOutOrder, cancelOrder } = useOrderStore();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [detail, setDetail] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const filtered = orders.filter((o) => filter === 'all' || o.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));

  const handlePay = (id: string) => { payOrder(id); showToast({ type: 'success', message: '已标记为已付款' }); };
  const handleConfirm = (id: string) => { confirmOrder(id); showToast({ type: 'success', message: '订单已确认' }); };
  const handleCheckIn = (id: string) => { checkInOrder(id); showToast({ type: 'success', message: '已办理入住' }); };
  const handleCheckOut = (id: string) => { checkOutOrder(id); showToast({ type: 'success', message: '已办理退房' }); };
  const handleCancel = () => {
    if (!detail) return;
    const res = cancelOrder(detail.id, cancelReason);
    setShowCancel(false);
    setCancelReason('');
    if (res.cancelFee > 0) {
      showToast({ type: 'warning', message: `订单已取消，扣费 ¥${res.cancelFee}，退款 ¥${res.refundAmount}` });
    } else {
      showToast({ type: 'success', message: '订单已取消，全额退款' });
    }
    setDetail(null);
  };

  const actionsFor = (o: Order) => {
    const acts: { label: string; icon: any; onClick: () => void; variant?: 'primary' }[] = [];
    if (o.status === 'pending') acts.push({ label: '标记付款', icon: Check, onClick: () => handlePay(o.id), variant: 'primary' });
    if (o.status === 'paid') acts.push({ label: '确认订单', icon: CheckSquare, onClick: () => handleConfirm(o.id) });
    if (o.status === 'confirmed') acts.push({ label: '办理入住', icon: Check, onClick: () => handleCheckIn(o.id) });
    if (o.status === 'checkedIn') acts.push({ label: '办理退房', icon: LogOut, onClick: () => handleCheckOut(o.id) });
    if (['pending', 'paid', 'confirmed'].includes(o.status)) {
      acts.push({ label: '取消订单', icon: LogOut, onClick: () => { setDetail(o); setShowCancel(true); } });
    }
    return acts;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">订单管控</h1>
        <p className="text-ink-300">查看并处理所有订单状态</p>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-ink-600 text-white'
                : 'bg-white text-ink-400 hover:text-ink-600 border border-ink-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center text-ink-300">暂无订单</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-50 text-ink-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3.5 font-semibold">订单号</th>
                <th className="text-left px-5 py-3.5 font-semibold">房间 / 入住人</th>
                <th className="text-left px-5 py-3.5 font-semibold">日期</th>
                <th className="text-right px-5 py-3.5 font-semibold">金额</th>
                <th className="text-center px-5 py-3.5 font-semibold">状态</th>
                <th className="text-right px-5 py-3.5 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-ink-100 hover:bg-cream-50/40 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-400">{o.id.slice(0, 14)}...</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ink-600">{roomMap[o.roomId]?.name || '已删除'}</div>
                    <div className="text-xs text-ink-300 flex items-center gap-1 mt-0.5"><User className="w-3 h-3" />{o.guestName} · <Phone className="w-3 h-3" />{o.guestPhone}</div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-400 text-xs">
                    <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{o.checkIn} ~ {o.checkOut}</div>
                    <div className="text-ink-300 mt-0.5 ml-5">{o.nights} 晚</div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-display text-lg text-clay-500">{fmt(o.finalAmount)}</td>
                  <td className="px-5 py-3.5 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(o)} className="btn-ghost btn-sm"><Eye className="w-3.5 h-3.5" /> 详情</button>
                      {actionsFor(o).map((a, i) => (
                        <button
                          key={i}
                          onClick={a.onClick}
                          className={a.variant === 'primary' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                        >
                          <a.icon className="w-3.5 h-3.5" /> {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail && !showCancel} onClose={() => setDetail(null)} title="订单详情" size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-ink-100">
              <div>
                <div className="text-xs text-ink-300 uppercase tracking-wide mb-1">订单号</div>
                <div className="font-mono text-sm text-ink-500">{detail.id}</div>
              </div>
              <StatusBadge status={detail.status} />
            </div>
            <div className="grid grid-cols-2 gap-5 text-sm">
              <div><label className="label">房间</label><div className="font-medium text-ink-600">{roomMap[detail.roomId]?.name || '已删除'}</div></div>
              <div><label className="label">入住人</label><div className="font-medium text-ink-600 flex items-center gap-2"><User className="w-4 h-4 text-ink-300" />{detail.guestName}</div></div>
              <div><label className="label">联系电话</label><div className="font-medium text-ink-600 flex items-center gap-2"><Phone className="w-4 h-4 text-ink-300" />{detail.guestPhone}</div></div>
              <div><label className="label">入住人数</label><div className="font-medium text-ink-600">{detail.guestCount} 人</div></div>
              <div><label className="label">入住</label><div className="font-medium text-ink-600">{fmtDateCN(detail.checkIn)}</div></div>
              <div><label className="label">退房</label><div className="font-medium text-ink-600">{fmtDateCN(detail.checkOut)}</div></div>
              <div><label className="label">下单时间</label><div className="font-medium text-ink-600">{detail.createdAt}</div></div>
              {detail.paidAt && <div><label className="label">付款时间</label><div className="font-medium text-ink-600">{detail.paidAt}</div></div>}
            </div>
            <div className="bg-cream-50 rounded-2xl p-5 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-ink-300">{detail.nights} 晚房价合计</span><span className="text-ink-500">{fmt(detail.originalAmount)}</span></div>
              {detail.discountAmount > 0 && (
                <div className="flex justify-between text-sm"><span className="text-sage-500">{detail.discountRuleName || '优惠'}</span><span className="text-sage-500">− {fmt(detail.discountAmount)}</span></div>
              )}
              <div className="flex justify-between pt-2 border-t border-cream-200"><span className="text-ink-400 font-medium">实付金额</span><span className="font-display text-2xl text-clay-500">{fmt(detail.finalAmount)}</span></div>
            </div>
            {detail.status === 'cancelled' && (
              <div className="bg-red-50 rounded-2xl p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-ink-400">取消扣费</span><span className="text-red-500 font-medium">{fmt(detail.cancelFee || 0)}</span></div>
                <div className="flex justify-between"><span className="text-ink-400">退款金额</span><span className="text-sage-500 font-medium">{fmt(detail.refundAmount || 0)}</span></div>
                {detail.cancelReason && <div className="pt-2 border-t border-red-100 text-ink-400">原因：{detail.cancelReason}</div>}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="取消订单"
        size="md"
        footer={
          <>
            <button onClick={() => setShowCancel(false)} className="btn-ghost">保留订单</button>
            <button onClick={handleCancel} className="btn-danger">确认取消</button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="bg-cream-50 rounded-2xl p-4 text-sm">
              <div className="text-ink-300 mb-2 text-xs uppercase tracking-wide">取消规则</div>
              <div className="space-y-1.5">
                {CANCEL_RULES.map((r) => (
                  <div key={r.range} className="flex justify-between">
                    <span className="text-ink-500">{r.range}</span>
                    <span className="text-ink-400">{r.fee} · {r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="label">取消原因（选填）</label>
              <textarea
                className="input min-h-[80px]"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="请输入取消原因..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
