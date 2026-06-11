import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayStatus, DatePrice } from '@/types';
import { monthGrid, toISO, fmtMonthYear, parseISO, fmt } from '@/utils/date';
import { fmt as fmtMoney } from '@/utils/price';

interface CalendarProps {
  prices: Record<string, DatePrice>;
  selectedCheckIn?: string | null;
  selectedCheckOut?: string | null;
  onSelectDate?: (date: string) => void;
  showStatusLegend?: boolean;
  showPrice?: boolean;
  allowSelect?: boolean;
  title?: string;
  highlightDates?: Record<string, 'maintenance' | 'booked' | 'available' | string>;
  onCellClick?: (date: string, price: DatePrice) => void;
}

const statusColor: Record<DayStatus | 'range' | 'checkIn' | 'checkOut' | string, string> = {
  available: 'bg-sage-100/60 text-ink-500',
  booked: 'bg-blue-50 text-blue-600',
  maintenance: 'bg-red-50 text-red-500',
  selected: 'bg-clay-100 text-clay-500',
  range: 'bg-clay-100/60 text-clay-500',
  checkIn: 'bg-gradient-to-br from-clay-300 to-clay-400 text-white shadow-sm',
  checkOut: 'bg-gradient-to-br from-clay-300 to-clay-400 text-white shadow-sm',
};

const statusDot: Record<DayStatus | string, string> = {
  available: 'bg-sage-300',
  booked: 'bg-blue-400',
  maintenance: 'bg-red-400',
  selected: 'bg-clay-300',
};

export default function Calendar({
  prices,
  selectedCheckIn,
  selectedCheckOut,
  onSelectDate,
  showStatusLegend = true,
  showPrice = true,
  allowSelect = true,
  title,
  onCellClick,
}: CalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const isInRange = (date: string) => {
    if (!selectedCheckIn || !selectedCheckOut) return false;
    const d = parseISO(date).getTime();
    return d > parseISO(selectedCheckIn).getTime() && d < parseISO(selectedCheckOut).getTime();
  };

  const prev = () =>
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }));
  const next = () =>
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }));

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <div className="text-xs text-ink-300 uppercase tracking-wide mb-1">{title}</div>}
          <div className="font-display text-xl text-ink-600">
            {fmtMonthYear(cursor.year, cursor.month)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="p-2 rounded-xl hover:bg-ink-50 text-ink-400 hover:text-ink-600 transition-colors"
            aria-label="上月"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="p-2 rounded-xl hover:bg-ink-50 text-ink-400 hover:text-ink-600 transition-colors"
            aria-label="下月"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {weekdays.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-ink-300 py-1.5">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="aspect-[4/3]" />;
          const iso = toISO(d);
          const info = prices[iso];
          const disabled = info?.status === 'booked' || info?.status === 'maintenance';
          const isCI = selectedCheckIn === iso;
          const isCO = selectedCheckOut === iso;
          const inRange = isInRange(iso);

          let cellClass = 'bg-white text-ink-500';
          if (info?.status === 'maintenance') cellClass = statusColor.maintenance;
          else if (info?.status === 'booked') cellClass = statusColor.booked;
          else if (isCI || isCO) cellClass = statusColor.checkIn;
          else if (inRange) cellClass = statusColor.range;
          else if (info?.status === 'available') cellClass = statusColor.available;

          const clickable = allowSelect && info?.status !== 'maintenance';

          return (
            <button
              key={idx}
              disabled={!clickable && !onCellClick}
              onClick={() => {
                if (onCellClick && info) onCellClick(iso, info);
                else if (clickable && onSelectDate) onSelectDate(iso);
              }}
              className={`aspect-[4/3] rounded-xl p-1.5 flex flex-col items-center justify-center text-xs transition-all ${cellClass} ${
                clickable ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-not-allowed opacity-90'
              }`}
            >
              <div className={`font-semibold ${isCI || isCO ? 'text-white' : ''}`}>{d.getDate()}</div>
              {showPrice && info && (
                <div className={`text-[10px] mt-0.5 ${isCI || isCO ? 'text-white/90' : ''}`}>
                  ¥{info.price}
                </div>
              )}
              {info?.status && info.status !== 'available' && (
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${statusDot[info.status] || 'bg-ink-200'}`} />
              )}
            </button>
          );
        })}
      </div>

      {showStatusLegend && (
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-ink-100 text-xs text-ink-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sage-300" /> 可订
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-400" /> 已预订
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400" /> 维修中
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-clay-300" /> 已选日期
          </div>
        </div>
      )}
    </div>
  );
}

export function PriceSummaryBar({
  nights,
  original,
  discount,
  final,
  discountName,
}: {
  nights: number;
  original: number;
  discount: number;
  final: number;
  discountName?: string;
}) {
  return (
    <div className="card p-5 bg-gradient-to-br from-clay-50 to-cream-50 border-clay-100">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-xs text-ink-300 uppercase tracking-wide mb-1">预订合计</div>
          <div className="font-display text-3xl text-clay-500">{fmtMoney(final)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-ink-400">共</div>
          <div className="font-display text-2xl text-ink-600">{nights} <span className="text-sm">晚</span></div>
        </div>
      </div>
      <div className="space-y-1.5 pt-3 border-t border-clay-100/70">
        <div className="flex justify-between text-sm text-ink-400">
          <span>房价合计</span>
          <span className="text-ink-500">{fmtMoney(original)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-sage-500">
              {discountName || '连住优惠'}
            </span>
            <span className="text-sage-500 font-medium">− {fmtMoney(discount)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: DayStatus | string }) {
  const map: Record<string, { label: string; className: string }> = {
    available: { label: '可订', className: 'bg-sage-100 text-sage-500' },
    booked: { label: '已订', className: 'bg-blue-50 text-blue-600' },
    maintenance: { label: '维修', className: 'bg-red-50 text-red-500' },
    pending: { label: '待付款', className: 'bg-amber-50 text-amber-600' },
    paid: { label: '已付款', className: 'bg-blue-50 text-blue-600' },
    confirmed: { label: '已确认', className: 'bg-sage-100 text-sage-500' },
    checkedIn: { label: '已入住', className: 'bg-indigo-50 text-indigo-600' },
    checkedOut: { label: '已退房', className: 'bg-ink-50 text-ink-400' },
    cancelled: { label: '已取消', className: 'bg-ink-50 text-ink-400' },
    scheduled: { label: '计划中', className: 'bg-amber-50 text-amber-600' },
    inProgress: { label: '进行中', className: 'bg-red-50 text-red-500' },
    completed: { label: '已完成', className: 'bg-sage-100 text-sage-500' },
  };
  const info = map[status] || { label: status, className: 'bg-ink-50 text-ink-400' };
  return <span className={`chip ${info.className}`}>{info.label}</span>;
}

export { fmt };
