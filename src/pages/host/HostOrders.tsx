import { useState } from 'react';
import { Eye, CalendarDays, User, Phone } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import Modal from '@/components/common/Modal';
import { StatusBadge } from '@/components/calendar/Calendar';
import { fmt } from '@/utils/price';
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

export default function HostOrders() {
  const orders = useOrderStore((s) => s.orders);
  const rooms = useRoomStore((s) => s.rooms);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [detail, setDetail] = useState<Order | null>(null);

  const filtered = orders.filter((o) => filter === 'all' || o.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title mb-2">订单列表</h1>
        <p className="text-ink-300">查看所有预订订单</p>
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
                <th className="text-left px-5 py-3.5 font-semibold">房间</th>
                <th className="text-left px-5 py-3.5 font-semibold">入住人</th>
                <th className="text-left px-5 py-3.5 font-semibold">入住日期</th>
                <th className="text-right px-5 py-3.5 font-semibold">金额</th>
                <th className="text-center px-5 py-3.5 font-semibold">状态</th>
                <th className="text-right px-5 py-3.5 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-ink-100 hover:bg-cream-50/40 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-400">{o.id.slice(0, 12)}...</td>
                  <td className="px-5 py-3.5 font-medium text-ink-600">{roomMap[o.roomId]?.name || '已删除'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-ink-600">
                      <User className="w-3.5 h-3.5 text-ink-300" />
                      {o.guestName}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-400 text-xs">
                    <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{o.checkIn} ~ {o.checkOut}</div>
                    <div className="text-ink-300 mt-0.5 ml-5">{o.nights} 晚</div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-display text-lg text-clay-500">{fmt(o.finalAmount)}</td>
                  <td className="px-5 py-3.5 text-center"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => setDetail(o)} className="btn-ghost btn-sm"><Eye className="w-3.5 h-3.5" /> 详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="订单详情" size="lg">
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
              <div>
                <label className="label">房间</label>
                <div className="font-medium text-ink-600">{roomMap[detail.roomId]?.name || '已删除'}</div>
              </div>
              <div>
                <label className="label">入住人</label>
                <div className="font-medium text-ink-600 flex items-center gap-2"><User className="w-4 h-4 text-ink-300" />{detail.guestName}</div>
              </div>
              <div>
                <label className="label">联系电话</label>
                <div className="font-medium text-ink-600 flex items-center gap-2"><Phone className="w-4 h-4 text-ink-300" />{detail.guestPhone}</div>
              </div>
              <div>
                <label className="label">入住人数</label>
                <div className="font-medium text-ink-600">{detail.guestCount} 人</div>
              </div>
              <div>
                <label className="label">入住日期</label>
                <div className="font-medium text-ink-600">{fmtDateCN(detail.checkIn)}</div>
              </div>
              <div>
                <label className="label">退房日期</label>
                <div className="font-medium text-ink-600">{fmtDateCN(detail.checkOut)}</div>
              </div>
              <div>
                <label className="label">下单时间</label>
                <div className="font-medium text-ink-600">{detail.createdAt}</div>
              </div>
              {detail.paidAt && (
                <div>
                  <label className="label">付款时间</label>
                  <div className="font-medium text-ink-600">{detail.paidAt}</div>
                </div>
              )}
            </div>
            <div className="bg-cream-50 rounded-2xl p-5 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-ink-300">共 {detail.nights} 晚房价合计</span><span className="text-ink-500">{fmt(detail.originalAmount)}</span></div>
              {detail.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-sage-500">{detail.discountRuleName || '优惠'}</span>
                  <span className="text-sage-500">− {fmt(detail.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-cream-200">
                <span className="text-ink-400 font-medium">实付金额</span>
                <span className="font-display text-2xl text-clay-500">{fmt(detail.finalAmount)}</span>
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
    </div>
  );
}
