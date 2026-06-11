import { useState } from 'react';
import { Eye, CalendarDays, User, Phone, AlertTriangle } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useUIStore } from '@/store/uiStore';
import Modal from '@/components/common/Modal';
import { StatusBadge } from '@/components/calendar/Calendar';
import { fmt, CANCEL_RULES } from '@/utils/price';
import { fmtDateCN, todayISO } from '@/utils/date';
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

export default function GuestOrders() {
  const orders = useOrderStore((s) => s.orders);
  const rooms = useRoomStore((s) => s.rooms);
  const { payOrder, cancelOrder } = useOrderStore();
  const showToast = useUIStore((s) => s.showToast);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [detail, setDetail] = useState<Order | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const today = todayISO();

  const filtered = orders
    .filter((o) => filter === 'all' || o.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));

  const handlePay = (id: string) => {
    payOrder(id);
    showToast({ type: 'success', message: '支付成功' });
  };

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">我的订单</h1>
        <p className="text-ink-300">查看并管理您的预订</p>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-gradient-to-br from-clay-300 to-clay-400 text-white shadow-soft'
                : 'bg-white text-ink-400 hover:text-ink-600 border border-ink-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-ink-300 mb-4">暂无订单</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => {
            const room = roomMap[o.roomId];
            const canCancel = ['pending', 'paid', 'confirmed'].includes(o.status) && o.checkIn > today;
            const canPay = o.status === 'pending';
            const upcoming = ['paid', 'confirmed'].includes(o.status) && o.checkIn >= today;
            return (
              <div key={o.id} className="card p-5">
                <div className="flex items-start gap-4">
                  {room && (
                    <img src={room.image} alt={room.name} className="w-24 h-24 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-medium text-ink-600">{room?.name || '已删除房间'}</h3>
                        <div className="text-xs text-ink-300 mt-0.5 flex items-center gap-2">
                          <span>{fmtDateCN(o.checkIn)} → {fmtDateCN(o.checkOut)}</span>
                          <span>·</span>
                          <span>{o.nights} 晚 · {o.guestCount} 人</span>
                        </div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    {upcoming && (
                      <div className="chip bg-clay-50 text-clay-500 mb-3">
                        距入住还有 {Math.ceil((new Date(o.checkIn + 'T14:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))} 天
                      </div>
                    )}
                    <div className="flex items-end justify-between">
                      <div className="font-display text-2xl text-clay-500">
                        {fmt(o.finalAmount)}
                        {o.discountAmount > 0 && (
                          <span className="text-xs text-sage-500 font-sans ml-2 align-middle">已优惠 {fmt(o.discountAmount)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setDetail(o)} className="btn-ghost btn-sm"><Eye className="w-3.5 h-3.5" /> 详情</button>
                        {canPay && <button onClick={() => handlePay(o.id)} className="btn-primary btn-sm">去支付</button>}
                        {canCancel && (
                          <button
                            onClick={() => { setDetail(o); setShowCancel(true); }}
                            className="btn-outline btn-sm text-red-500 border-red-200 hover:bg-red-50"
                          >
                            取消订单
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
              <div className="text-xs text-ink-300 uppercase tracking-wide mb-2">每日明细</div>
              {detail.dailyBreakdown.map((d) => (
                <div key={d.date} className="flex justify-between text-sm">
                  <span className="text-ink-400">{d.date}</span>
                  <span className="text-ink-500">{fmt(d.price)}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-cream-200 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-ink-300">{detail.nights} 晚房价</span><span className="text-ink-500">{fmt(detail.originalAmount)}</span></div>
                {detail.discountAmount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-sage-500">{detail.discountRuleName || '优惠'}</span><span className="text-sage-500">− {fmt(detail.discountAmount)}</span></div>
                )}
                <div className="flex justify-between pt-1"><span className="text-ink-400 font-medium">实付</span><span className="font-display text-2xl text-clay-500">{fmt(detail.finalAmount)}</span></div>
              </div>
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
            <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-2.5 border border-amber-100">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 leading-relaxed">
                <div className="font-semibold mb-1">取消将按以下规则扣费</div>
                <div className="space-y-1 mt-2">
                  {CANCEL_RULES.map((r) => (
                    <div key={r.range} className="flex justify-between">
                      <span>{r.range}</span><span className="font-medium">{r.fee} · {r.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="label">取消原因（选填）</label>
              <textarea
                className="input min-h-[80px]"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="请告诉我们取消原因..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
