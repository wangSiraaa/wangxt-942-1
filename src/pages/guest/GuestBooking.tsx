import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, CalendarCheck, ArrowLeft, CreditCard, CheckCircle2 } from 'lucide-react';
import { useRoomStore } from '@/store/roomStore';
import { useOrderStore } from '@/store/orderStore';
import { useUIStore } from '@/store/uiStore';
import { fmt, CANCEL_RULES } from '@/utils/price';
import { fmtDateCN } from '@/utils/date';

interface PricingResult {
  nights: number;
  dailyBreakdown: { date: string; price: number; source: string }[];
  originalAmount: number;
  discountAmount: number;
  discountRate: number;
  discountRuleName?: string;
  finalAmount: number;
}

export default function GuestBooking() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { roomId: string; checkIn: string; checkOut: string; guestCount: number; pricing: PricingResult } };
  const { roomId, checkIn, checkOut, guestCount, pricing } = location.state || {};
  const room = useRoomStore((s) => s.rooms.find((r) => r.id === roomId));
  const { createOrder, payOrder } = useOrderStore();
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [remark, setRemark] = useState('');
  const [paid, setPaid] = useState<string | null>(null);

  if (!room || !checkIn || !checkOut || !pricing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-10 text-center">
          <p className="text-ink-400 mb-4">未找到预订信息</p>
          <button onClick={() => navigate('/guest')} className="btn-primary">返回选择</button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (!name.trim()) return showToast({ type: 'error', message: '请填写入住人姓名' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return showToast({ type: 'error', message: '请输入有效的手机号' });
    const orderId = createOrder({
      roomId: room.id,
      guestName: name.trim(),
      guestPhone: phone.trim(),
      guestEmail: email.trim() || undefined,
      checkIn,
      checkOut,
      nights: pricing.nights,
      guestCount,
      originalAmount: pricing.originalAmount,
      discountAmount: pricing.discountAmount,
      discountRate: pricing.discountRate,
      discountRuleName: pricing.discountRuleName,
      finalAmount: pricing.finalAmount,
      dailyBreakdown: pricing.dailyBreakdown,
      remark: remark.trim() || undefined,
      status: 'pending',
    });
    showToast({ type: 'success', message: '订单已创建，请完成付款' });
    setTimeout(() => {
      payOrder(orderId);
      setPaid(orderId);
      showToast({ type: 'success', message: '付款成功！订单已确认' });
    }, 800);
  };

  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-10 max-w-md w-full text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-sage-500" />
          </div>
          <h2 className="font-display text-2xl text-ink-600 mb-2">预订成功</h2>
          <p className="text-ink-300 mb-6">订单已确认，期待您的入住</p>
          <div className="bg-cream-50 rounded-2xl p-5 text-left text-sm space-y-2 mb-6">
            <div className="flex justify-between"><span className="text-ink-300">房间</span><span className="font-medium text-ink-600">{room.name}</span></div>
            <div className="flex justify-between"><span className="text-ink-300">入住</span><span className="font-medium text-ink-600">{fmtDateCN(checkIn)}</span></div>
            <div className="flex justify-between"><span className="text-ink-300">退房</span><span className="font-medium text-ink-600">{fmtDateCN(checkOut)}</span></div>
            <div className="flex justify-between"><span className="text-ink-300">共</span><span className="font-medium text-ink-600">{pricing.nights} 晚 · {guestCount} 人</span></div>
            <div className="flex justify-between pt-2 border-t border-cream-200"><span className="text-ink-400 font-medium">实付</span><span className="font-display text-2xl text-clay-500">{fmt(pricing.finalAmount)}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/guest')} className="btn-ghost flex-1">继续预订</button>
            <button onClick={() => navigate('/guest/orders')} className="btn-primary flex-1">查看订单</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/guest')} className="btn-ghost mb-6 gap-1.5">
        <ArrowLeft className="w-4 h-4" /> 返回选择日期
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <div className="card p-6">
            <h2 className="section-title mb-5">入住人信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">姓名 <span className="text-red-400">*</span></label>
                <div className="relative">
                  <User className="w-4 h-4 text-ink-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input className="input pl-10" value={name} onChange={(e) => setName(e.target.value)} placeholder="入住人姓名" />
                </div>
              </div>
              <div>
                <label className="label">手机号 <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-ink-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input className="input pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 位手机号" maxLength={11} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label">邮箱（选填）</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="用于接收订单通知" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label">备注（选填）</label>
                <textarea className="input min-h-[80px]" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="特殊需求、到店时间等" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="section-title mb-4">取消政策</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {CANCEL_RULES.map((r) => (
                <div key={r.range} className="p-4 rounded-2xl bg-cream-50 text-center">
                  <div className="font-display text-lg text-ink-600 mb-0.5">{r.fee}</div>
                  <div className="text-ink-400 text-xs">{r.range}</div>
                  <div className="text-ink-300 text-xs mt-1">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-6 lg:sticky lg:top-6">
            <div className="flex items-center gap-3 pb-4 border-b border-ink-100 mb-4">
              <img src={room.image} alt={room.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-ink-600 truncate">{room.name}</div>
                <div className="text-xs text-ink-300 mt-0.5">{room.bedType} · {room.area}㎡</div>
              </div>
            </div>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-300 flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" />入住</span><span className="font-medium text-ink-600">{fmtDateCN(checkIn)}</span></div>
              <div className="flex justify-between"><span className="text-ink-300 flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" />退房</span><span className="font-medium text-ink-600">{fmtDateCN(checkOut)}</span></div>
              <div className="flex justify-between"><span className="text-ink-300">入住人</span><span className="font-medium text-ink-600">{guestCount} 位</span></div>
            </div>
            <div className="bg-cream-50/60 rounded-xl p-3 mb-4 max-h-44 overflow-y-auto scrollbar-thin text-xs space-y-1">
              {pricing.dailyBreakdown.map((d) => (
                <div key={d.date} className="flex justify-between text-ink-400">
                  <span>{d.date} {d.source === 'holiday' ? <span className="chip bg-amber-50 text-amber-600 !py-0 !px-1.5 text-[10px] ml-1">节假日</span> : null}</span>
                  <span className="text-ink-500">{fmt(d.price)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm border-t border-ink-100 pt-4">
              <div className="flex justify-between">
                <span className="text-ink-300">{pricing.nights} 晚房价</span>
                <span className="text-ink-500">{fmt(pricing.originalAmount)}</span>
              </div>
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sage-500">{pricing.discountRuleName || '优惠'}</span>
                  <span className="text-sage-500">− {fmt(pricing.discountAmount)}</span>
                </div>
              )}
            </div>
            <div className="flex items-end justify-between pt-4 border-t border-ink-100 mt-4 mb-5">
              <span className="text-ink-400 text-sm">应付总额</span>
              <span className="font-display text-3xl text-clay-500">{fmt(pricing.finalAmount)}</span>
            </div>
            <button onClick={submit} className="btn-primary w-full text-base py-3">
              <CreditCard className="w-4.5 h-4.5" /> 确认并支付
            </button>
            <p className="text-[11px] text-center text-ink-200 mt-3">Demo 演示：点击后自动完成模拟支付</p>
          </div>
        </div>
      </div>
    </div>
  );
}
