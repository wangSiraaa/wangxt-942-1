import { useState, useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { getMonthMatrix, getMonthName, getWeekdayNames, formatDate, isSameDay, addDays, getToday, parseDate, getNightsBetween } from '../utils/dateUtils';
import { getOrderStatusColor } from '../utils/orderStateMachine';
import { calculatePrice } from '../utils/priceCalculator';
import type { CalendarDayStatus, BenefitSource, AvailabilityExplanation, ChannelInventorySnapshot, ExceptionType } from '../types';
import { ChevronLeft, ChevronRight, Wrench, Lock, Unlock, AlertTriangle, AlertCircle, Info, ShoppingCart, X, HelpCircle, TrendingUp, TrendingDown, Zap, Users, Calendar as CalendarIcon, Shield } from 'lucide-react';

interface CalendarDayCellProps {
  date: string | null;
  roomId: string;
  status: CalendarDayStatus | undefined;
  isSelected: boolean;
  isInRange: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const channelNames: Record<string, string> = {
  direct: '直销',
  ota: 'OTA',
  corporate_longstay: '企业长租',
  event_buyout: '包栋',
};

const CalendarDayCell = ({ date, roomId, status, isSelected, isInRange, onClick, onContextMenu }: CalendarDayCellProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const explanation: AvailabilityExplanation | null = useMemo(() => {
    if (!date) return null;
    try {
      return useBookingStore.getState().getAvailabilityExplanation(roomId, date);
    } catch (e) {
      return null;
    }
  }, [date, roomId]);
  
  const channelSnapshots: ChannelInventorySnapshot[] = useMemo(() => {
    if (!date) return [];
    try {
      const snaps = useBookingStore.getState().getAllChannelSnapshots(roomId, date);
      return snaps || [];
    } catch (e) {
      return [];
    }
  }, [date, roomId]);
  
  const exceptions = useMemo(() => {
    if (!date) return [];
    try {
      return useBookingStore.getState().getExceptionQueue().filter(
        e => e.roomId === roomId && e.date === date && e.status !== 'resolved' && e.status !== 'ignored'
      );
    } catch (e) {
      return [];
    }
  }, [date, roomId]);

  if (!date) {
    return <div className="h-20 border border-gray-100 bg-gray-50" />;
  }

  const day = parseInt(date.split('-')[2]);
  const today = getToday();
  const isToday = isSameDay(date, today);
  const isPast = date < today;

  let bgColor = 'bg-white';
  let borderColor = 'border-gray-200';
  let textColor = 'text-gray-900';
  
  if (explanation) {
    if (explanation.saleStatus === 'unavailable') {
      const { factors } = explanation;
      if (factors.maintenance) {
        bgColor = 'bg-red-100';
        borderColor = 'border-red-400';
      } else if (factors.locked) {
        bgColor = 'bg-purple-100';
        borderColor = 'border-purple-400';
      } else if (factors.soldOut || factors.inventoryExhausted) {
        bgColor = 'bg-blue-100';
        borderColor = 'border-blue-400';
      } else if (factors.cleaningPending) {
        bgColor = 'bg-amber-100';
        borderColor = 'border-amber-400';
      } else if (factors.oversellRisk) {
        bgColor = 'bg-rose-100';
        borderColor = 'border-rose-500';
      } else {
        bgColor = 'bg-gray-200';
      }
    } else if (explanation.saleStatus === 'limited') {
      bgColor = 'bg-amber-50';
      borderColor = 'border-amber-400';
      textColor = 'text-amber-900';
    } else {
      if (status?.isHoliday) bgColor = 'bg-yellow-50';
      else if (status?.isWeekend) bgColor = 'bg-amber-50';
    }
  } else {
    if (isPast) {
      bgColor = 'bg-gray-50';
      textColor = 'text-gray-400';
    } else if (!status?.available) {
      if (status?.maintenanceType === 'full_day') { bgColor = 'bg-red-100'; borderColor = 'border-red-300'; }
      else if (status?.maintenanceType) { bgColor = 'bg-orange-100'; borderColor = 'border-orange-300'; }
      else if (status?.isLocked && !status?.isReleased) { bgColor = 'bg-purple-100'; borderColor = 'border-purple-300'; }
      else if (status?.orderIds.length > 0) { bgColor = 'bg-blue-100'; borderColor = 'border-blue-300'; }
      else bgColor = 'bg-gray-200';
    } else {
      if (status?.isHoliday) bgColor = 'bg-yellow-50';
      if (status?.isWeekend) bgColor = 'bg-amber-50';
    }
  }

  if (isSelected) {
    borderColor = 'border-indigo-500 ring-2 ring-indigo-200';
  } else if (isInRange) {
    borderColor = 'border-indigo-300';
  }

  if (status?.conflicts && status.conflicts.length > 0) {
    borderColor = 'border-red-500 ring-2 ring-red-200';
  }
  
  if (exceptions.length > 0) {
    const criticalEx = exceptions.find(e => e.severity === 'critical');
    if (criticalEx) {
      borderColor = 'border-rose-600 ring-2 ring-rose-200';
    } else {
      borderColor = 'border-orange-500 ring-2 ring-orange-200';
    }
  }

  const oversoldChannel = channelSnapshots.find(s => s.oversoldUnits > 0);
  const hasOversell = !!oversoldChannel || (explanation?.factors.oversellRisk);
  
  const availableChannels = channelSnapshots.filter(s => s.availableUnits > 0);

  return (
    <div
      className={`h-20 border ${bgColor} ${borderColor} p-1 cursor-pointer hover:shadow-md transition-all relative ${textColor} text-xs group`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex justify-between items-start">
        <span className={`font-medium ${isToday ? 'text-indigo-600 font-bold' : ''}`}>{day}</span>
        <div className="flex gap-0.5 items-center">
          {status?.maintenanceType && (
            <Wrench className={`w-3 h-3 ${status.maintenanceType === 'full_day' ? 'text-red-600' : 'text-orange-600'}`} />
          )}
          {status?.isLocked && !status?.isReleased && (
            <Lock className="w-3 h-3 text-purple-600" />
          )}
          {status?.isReleased && (
            <Unlock className="w-3 h-3 text-green-600" />
          )}
          {status?.conflicts && status.conflicts.length > 0 && (
            <AlertTriangle className="w-3 h-3 text-red-600" />
          )}
          {hasOversell && (
            <AlertCircle className="w-3 h-3 text-rose-600 animate-pulse" />
          )}
          {explanation && (
            <HelpCircle className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
          )}
        </div>
      </div>
      
      <div className="mt-1">
        {status?.available && explanation?.saleStatus !== 'unavailable' && (
          <span className={`text-xs font-medium ${explanation?.saleStatus === 'limited' ? 'text-amber-700' : 'text-green-700'}`}>
            ¥{status.price}
          </span>
        )}
        {explanation?.saleStatus === 'limited' && (
          <span className="ml-1 text-[10px] text-amber-600 font-medium">限售</span>
        )}
        {explanation?.saleStatus === 'unavailable' && !isPast && (
          <span className="text-[10px] text-gray-500 font-medium">
            {explanation.primaryReason}
          </span>
        )}
      </div>
      
      {channelSnapshots.length > 0 && explanation?.saleStatus !== 'unavailable' && !isPast && (
        <div className="flex gap-0.5 mt-0.5 flex-wrap">
          {availableChannels.slice(0, 3).map(snap => (
            <span key={snap.channel} className={`text-[9px] px-1 rounded ${
              snap.oversoldUnits > 0 ? 'bg-rose-200 text-rose-800' :
              snap.channel === 'direct' ? 'bg-green-100 text-green-700' :
              snap.channel === 'ota' ? 'bg-blue-100 text-blue-700' :
              snap.channel === 'corporate_longstay' ? 'bg-indigo-100 text-indigo-700' :
              'bg-purple-100 text-purple-700'
            }`}>
              {channelNames[snap.channel]}{snap.availableUnits}
            </span>
          ))}
          {availableChannels.length > 3 && (
            <span className="text-[9px] text-gray-500">+{availableChannels.length - 3}</span>
          )}
        </div>
      )}
      
      {status?.orderIds.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {status.orderIds.slice(0, 1).map(orderId => (
            <span key={orderId} className={`text-[9px] px-1 rounded ${getOrderStatusColor(
              useBookingStore.getState().orders.find(o => o.id === orderId)?.status || 'pending'
            )}`}>
              {useBookingStore.getState().orders.find(o => o.id === orderId)?.orderNo.slice(-4)}
            </span>
          ))}
          {status.orderIds.length > 1 && (
            <span className="text-[9px] text-gray-500">+{status.orderIds.length - 1}</span>
          )}
        </div>
      )}
      
      {status?.maintenanceType === 'half_day_morning' && (
        <div className="absolute top-0 left-0 w-1/2 h-full bg-orange-200 opacity-30 pointer-events-none" />
      )}
      {status?.maintenanceType === 'half_day_afternoon' && (
        <div className="absolute top-0 right-0 w-1/2 h-full bg-orange-200 opacity-30 pointer-events-none" />
      )}
      
      {showTooltip && explanation && !isPast && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 text-left pointer-events-none">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
            <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" />
              {date}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              explanation.saleStatus === 'available' ? 'bg-green-100 text-green-700' :
              explanation.saleStatus === 'limited' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {explanation.saleStatus === 'available' ? '可售' : 
               explanation.saleStatus === 'limited' ? '限售' : '不可售'}
            </span>
          </div>
          
          <div className="text-xs text-gray-700 mb-2">
            <span className="font-medium">主要原因：</span>
            {explanation.primaryReason}
          </div>
          
          <div className="space-y-1 text-[11px] mb-2">
            <div className="grid grid-cols-2 gap-1">
              <div className={`flex items-center gap-1 ${explanation.factors.maintenance ? 'text-red-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.maintenance ? 'bg-red-500' : 'bg-gray-200'}`} />
                维修占用
              </div>
              <div className={`flex items-center gap-1 ${explanation.factors.locked ? 'text-purple-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.locked ? 'bg-purple-500' : 'bg-gray-200'}`} />
                锁房
              </div>
              <div className={`flex items-center gap-1 ${explanation.factors.soldOut ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.soldOut ? 'bg-blue-500' : 'bg-gray-200'}`} />
                已售罄
              </div>
              <div className={`flex items-center gap-1 ${explanation.factors.inventoryExhausted ? 'text-orange-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.inventoryExhausted ? 'bg-orange-500' : 'bg-gray-200'}`} />
                库存耗尽
              </div>
              <div className={`flex items-center gap-1 ${explanation.factors.channelRestricted ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.channelRestricted ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                渠道受限
              </div>
              <div className={`flex items-center gap-1 ${explanation.factors.cleaningPending ? 'text-amber-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.cleaningPending ? 'bg-amber-500' : 'bg-gray-200'}`} />
                清洁未完成
              </div>
              <div className={`flex items-center gap-1 col-span-2 ${explanation.factors.oversellRisk ? 'text-rose-600' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${explanation.factors.oversellRisk ? 'bg-rose-500' : 'bg-gray-200'}`} />
                超卖风险
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-[11px] text-gray-600 pt-2 border-t border-gray-100">
            <span>总库存: <b>{explanation.totalInventory}</b></span>
            <span>可用: <b className={explanation.availableInventory > 0 ? 'text-green-600' : 'text-gray-500'}>{explanation.availableInventory}</b></span>
          </div>
          
          {channelSnapshots.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-[11px] font-medium text-gray-700 mb-1">渠道库存分布：</div>
              <div className="grid grid-cols-2 gap-1">
                {channelSnapshots.map(snap => (
                  <div key={snap.channel} className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-600">{channelNames[snap.channel]}</span>
                    <span className={`font-medium ${
                      snap.oversoldUnits > 0 ? 'text-rose-600' :
                      snap.availableUnits > 0 ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {snap.availableUnits}/{snap.totalUnits}
                      {snap.oversoldUnits > 0 && <span className="text-rose-500"> 超{snap.oversoldUnits}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {explanation.detailedReasons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-[11px] font-medium text-gray-700 mb-1">详细说明：</div>
              <ul className="text-[10px] text-gray-600 space-y-0.5 list-disc list-inside">
                {explanation.detailedReasons.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default function AvailabilityCalendar() {
  const { 
    rooms, calendarStatus, selectedRoomIds, selectedDate, 
    setSelectedDate, setSelectedRoomIds, 
    calendarStartDate, setCalendarRange,
    currentRole
  } = useBookingStore();
  
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseDate(calendarStartDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [bookingRoomId, setBookingRoomId] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: string; roomId: string } | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    guestName: '',
    guestPhone: '',
    guestCount: 2,
  });

  const displayedRooms = useMemo(() => {
    if (selectedRoomIds.length > 0) {
      return rooms.filter(r => selectedRoomIds.includes(r.id));
    }
    return rooms;
  }, [rooms, selectedRoomIds]);

  const monthMatrix = useMemo(() => {
    return getMonthMatrix(viewMonth.year, viewMonth.month);
  }, [viewMonth.year, viewMonth.month]);

  const weekdayNames = getWeekdayNames();

  const handlePrevMonth = () => {
    setViewMonth(v => {
      const newMonth = v.month - 1;
      if (newMonth < 0) {
        return { year: v.year - 1, month: 11 };
      }
      return { ...v, month: newMonth };
    });
  };

  const handleNextMonth = () => {
    setViewMonth(v => {
      const newMonth = v.month + 1;
      if (newMonth > 11) {
        return { year: v.year + 1, month: 0 };
      }
      return { ...v, month: newMonth };
    });
  };

  const handleDayClick = (date: string, roomId: string) => {
    if (currentRole === 'guest') {
      if (!rangeStart) {
        setRangeStart(date);
        setRangeEnd(null);
      } else if (!rangeEnd) {
        if (date >= rangeStart) {
          setRangeEnd(date);
        } else {
          setRangeStart(date);
          setRangeEnd(null);
        }
      } else {
        setRangeStart(date);
        setRangeEnd(null);
      }
    }
    setSelectedDate(date);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, date: string, roomId: string) => {
    e.preventDefault();
    if (currentRole !== 'guest') {
      setContextMenu({ x: e.clientX, y: e.clientY, date, roomId });
    }
  };

  const { priceVersions, holidayPrices, longStayDiscounts } = useBookingStore();

  const isDateInRange = (date: string) => {
    if (!rangeStart || !rangeEnd) return false;
    return date >= rangeStart && date <= rangeEnd;
  };

  const availableRoomsForBooking = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return displayedRooms.filter(room => {
      const avail = useBookingStore.getState().getAvailability(room.id, rangeStart, rangeEnd);
      return avail.available;
    });
  }, [rangeStart, rangeEnd, displayedRooms]);

  const bookingPricePreview = useMemo(() => {
    if (!bookingRoomId || !rangeStart || !rangeEnd) return null;
    const room = rooms.find(r => r.id === bookingRoomId);
    if (!room) return null;
    return calculatePrice(room, rangeStart, rangeEnd, priceVersions, holidayPrices, longStayDiscounts);
  }, [bookingRoomId, rangeStart, rangeEnd, rooms, priceVersions, holidayPrices, longStayDiscounts]);

  const handleOpenBooking = () => {
    if (!rangeStart || !rangeEnd) return;
    if (availableRoomsForBooking.length === 0) {
      alert('所选日期范围内没有可预订的房间');
      return;
    }
    setBookingRoomId(availableRoomsForBooking[0].id);
    setShowBookingModal(true);
  };

  const handleConfirmBooking = () => {
    const { createOrder, currentUserId } = useBookingStore.getState();
    if (!bookingRoomId || !rangeStart || !rangeEnd) return;
    if (!bookingForm.guestName || !bookingForm.guestPhone) {
      alert('请填写入住人信息');
      return;
    }
    if (!bookingPricePreview) return;

    createOrder({
      roomId: bookingRoomId,
      guestId: currentUserId,
      guestName: bookingForm.guestName,
      guestPhone: bookingForm.guestPhone,
      checkinDate: rangeStart,
      checkoutDate: rangeEnd,
      guestCount: bookingForm.guestCount,
      priceSnapshot: {
        basePrice: bookingPricePreview.basePrice,
        holidayPremium: bookingPricePreview.holidayPremium,
        weekendPremium: bookingPricePreview.weekendPremium,
        longStayDiscount: bookingPricePreview.longStayDiscount,
        otherDiscounts: bookingPricePreview.otherDiscounts,
        totalPrice: bookingPricePreview.totalPrice,
        benefitSource: bookingPricePreview.benefitSource as BenefitSource,
        benefitAmount: bookingPricePreview.benefitAmount,
      },
      paidAmount: 0,
    });

    setShowBookingModal(false);
    setRangeStart(null);
    setRangeEnd(null);
    setBookingRoomId('');
    setBookingForm({ guestName: '', guestPhone: '', guestCount: 2 });
    alert('订单创建成功！请在订单管理中确认和支付。');
  };

  const handleQuickAction = (action: string, date: string, roomId: string) => {
    const { createMaintenance, createLock, createRelease, releaseLock, cancelMaintenance, maintenances, locks } = useBookingStore.getState();
    
    switch (action) {
      case 'maintenance_full':
        createMaintenance({
          roomId,
          startDate: date,
          endDate: date,
          type: 'full_day',
          reason: '手动标记',
          operatorId: useBookingStore.getState().currentUserId,
        });
        break;
      case 'maintenance_morning':
        createMaintenance({
          roomId,
          startDate: date,
          endDate: date,
          type: 'half_day_morning',
          reason: '手动标记',
          operatorId: useBookingStore.getState().currentUserId,
        });
        break;
      case 'maintenance_afternoon':
        createMaintenance({
          roomId,
          startDate: date,
          endDate: date,
          type: 'half_day_afternoon',
          reason: '手动标记',
          operatorId: useBookingStore.getState().currentUserId,
        });
        break;
      case 'lock':
        createLock({
          roomId,
          startDate: date,
          endDate: date,
          reason: '手动锁房',
          lockedBy: useBookingStore.getState().currentUserId,
        });
        break;
      case 'release':
        createRelease({
          roomId,
          date,
          reason: '手动放量',
          operatorId: useBookingStore.getState().currentUserId,
        });
        break;
      case 'release_lock':
        const lock = locks.find(l => l.roomId === roomId && !l.releasedAt && l.startDate <= date && l.endDate >= date);
        if (lock) releaseLock(lock.id);
        break;
      case 'cancel_maintenance':
        const mt = maintenances.find(m => m.roomId === roomId && m.startDate <= date && m.endDate >= date);
        if (mt) cancelMaintenance(mt.id);
        break;
    }
    setContextMenu(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">房态日历</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">显示房间：</label>
              <select 
                multiple
                className="text-sm border rounded px-2 py-1 h-20"
                value={selectedRoomIds}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value);
                  setSelectedRoomIds(values);
                }}
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {viewMonth.year}年 {getMonthName(viewMonth.month)}
              </span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-400 rounded" />
            <span className="text-gray-600">可售</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-50 border border-amber-400 rounded" />
            <span className="text-gray-600">限售</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
            <span className="text-gray-600">已预订</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
            <span className="text-gray-600">全天维修</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded" />
            <span className="text-gray-600">半日维修</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded" />
            <span className="text-gray-600">已锁房</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-100 border border-amber-400 rounded" />
            <span className="text-gray-600">清洁中</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-rose-100 border border-rose-500 rounded" />
            <span className="text-gray-600">超卖风险</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-50 rounded" />
            <span className="text-gray-600">节假日</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-50 rounded" />
            <span className="text-gray-600">周末</span>
          </div>
          <div className="h-4 w-px bg-gray-300 mx-1" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">直销</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">OTA</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">长租</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">包栋</span>
          </div>
        </div>
        
        {currentRole === 'guest' && rangeStart && (
          <div className="mt-3 p-2 bg-indigo-50 rounded text-sm text-indigo-700">
            {rangeEnd ? (
              <span>已选择：{rangeStart} 至 {rangeEnd}</span>
            ) : (
              <span>请选择退房日期（点击日历）</span>
            )}
          </div>
        )}
        
        {currentRole !== 'guest' && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600 flex items-center gap-2">
            <Info className="w-4 h-4" />
            <span>右键点击日期单元格可快速操作：标记维修、锁房、放量等</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 p-2 text-left text-xs font-medium text-gray-700 w-32">
                房间 / 日期
              </th>
              {weekdayNames.map((name, i) => (
                <th key={i} className={`border border-gray-200 p-2 text-center text-xs font-medium w-24 ${i === 0 || i === 6 ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'}`}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRooms.map((room, roomIdx) => (
              monthMatrix.map((week, weekIdx) => (
                <tr key={`${room.id}-${weekIdx}`} className={roomIdx === 0 && weekIdx === 0 ? '' : ''}>
                  {weekIdx === 0 && (
                    <td 
                      rowSpan={monthMatrix.length} 
                      className="sticky left-0 z-10 bg-white border border-gray-200 p-2 align-top"
                    >
                      <div className="font-medium text-sm text-gray-900">{room.name}</div>
                      <div className="text-xs text-gray-500">{room.roomNumber}</div>
                      <div className="text-xs text-green-600 mt-1">¥{room.basePrice}/晚</div>
                      <div className="text-xs text-gray-500 mt-1">
                        最多{room.maxGuests}人 · {room.bedCount}床 · {room.area}㎡
                      </div>
                    </td>
                  )}
                  {week.map((date, dayIdx) => {
                    const status = date ? calendarStatus.get(`${room.id}_${date}`) : undefined;
                    return (
                      <td key={dayIdx} className="p-0">
                        <CalendarDayCell
                          date={date}
                          roomId={room.id}
                          status={status}
                          isSelected={date === selectedDate}
                          isInRange={!!(date && isDateInRange(date))}
                          onClick={() => date && handleDayClick(date, room.id)}
                          onContextMenu={(e) => date && handleContextMenu(e, date, room.id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      {currentRole === 'guest' && (rangeStart || rangeEnd) && (
        <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-gray-600">已选日期</div>
                <div className="font-semibold text-gray-900">
                  {rangeStart || '请选择入住日期'} → {rangeEnd || '请选择退房日期'}
                </div>
              </div>
              {rangeStart && rangeEnd && (
                <>
                  <div className="h-8 w-px bg-gray-300" />
                  <div>
                    <div className="text-sm text-gray-600">晚数</div>
                    <div className="font-semibold text-gray-900">{getNightsBetween(rangeStart, rangeEnd)} 晚</div>
                  </div>
                  <div className="h-8 w-px bg-gray-300" />
                  <div>
                    <div className="text-sm text-gray-600">可预订房间</div>
                    <div className="font-semibold text-green-600">{availableRoomsForBooking.length} 间</div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setRangeStart(null); setRangeEnd(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-white text-sm"
              >
                清除选择
              </button>
              <button
                onClick={handleOpenBooking}
                disabled={!rangeStart || !rangeEnd || availableRoomsForBooking.length === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                立即预订
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">确认预订</h3>
              <button onClick={() => setShowBookingModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">入住日期</span>
                  <span className="font-medium">{rangeStart}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">退房日期</span>
                  <span className="font-medium">{rangeEnd}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">共</span>
                  <span className="font-medium">{getNightsBetween(rangeStart!, rangeEnd!)} 晚</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择房间</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={bookingRoomId}
                  onChange={(e) => setBookingRoomId(e.target.value)}
                >
                  {availableRoomsForBooking.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} - ¥{r.basePrice}/晚（{r.maxGuests}人·{r.bedCount}床）
                    </option>
                  ))}
                </select>
              </div>

              {bookingPricePreview && (
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">基础房价</span>
                      <span>¥{bookingPricePreview.basePrice.toFixed(2)}</span>
                    </div>
                    {bookingPricePreview.holidayPremium > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>节假日溢价</span>
                        <span>+¥{bookingPricePreview.holidayPremium.toFixed(2)}</span>
                      </div>
                    )}
                    {bookingPricePreview.weekendPremium > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>周末溢价</span>
                        <span>+¥{bookingPricePreview.weekendPremium.toFixed(2)}</span>
                      </div>
                    )}
                    {bookingPricePreview.longStayDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>连住折扣</span>
                        <span>-¥{bookingPricePreview.longStayDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-indigo-200 pt-2 flex justify-between font-semibold">
                      <span>总价</span>
                      <span className="text-xl text-indigo-600">¥{bookingPricePreview.totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入住人姓名</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={bookingForm.guestName}
                    onChange={(e) => setBookingForm(f => ({ ...f, guestName: e.target.value }))}
                    placeholder="请输入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={bookingForm.guestPhone}
                    onChange={(e) => setBookingForm(f => ({ ...f, guestPhone: e.target.value }))}
                    placeholder="请输入电话"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">入住人数</label>
                <input
                  type="number"
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={bookingForm.guestCount}
                  onChange={(e) => setBookingForm(f => ({ ...f, guestCount: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBookingModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={!bookingRoomId || !bookingForm.guestName || !bookingForm.guestPhone || !bookingPricePreview}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                确认预订
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs text-gray-500">{contextMenu.date}</div>
          </div>
          {currentRole === 'operator' && (
            <>
              <div className="px-2 py-1 text-xs font-medium text-gray-500">维修标记</div>
              <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => handleQuickAction('maintenance_full', contextMenu.date, contextMenu.roomId)}>
                <Wrench className="w-4 h-4 text-red-600" /> 全天维修
              </button>
              <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => handleQuickAction('maintenance_morning', contextMenu.date, contextMenu.roomId)}>
                <Wrench className="w-4 h-4 text-orange-600" /> 上午维修
              </button>
              <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => handleQuickAction('maintenance_afternoon', contextMenu.date, contextMenu.roomId)}>
                <Wrench className="w-4 h-4 text-orange-600" /> 下午维修
              </button>
              <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 text-red-600"
                onClick={() => handleQuickAction('cancel_maintenance', contextMenu.date, contextMenu.roomId)}>
                取消维修
              </button>
            </>
          )}
          {(currentRole === 'host' || currentRole === 'operator') && (
            <>
              <div className="px-2 py-1 text-xs font-medium text-gray-500 mt-1">锁房管理</div>
              <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => handleQuickAction('lock', contextMenu.date, contextMenu.roomId)}>
                <Lock className="w-4 h-4 text-purple-600" /> 锁房
              </button>
              <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => handleQuickAction('release_lock', contextMenu.date, contextMenu.roomId)}>
                <Unlock className="w-4 h-4 text-green-600" /> 解锁
              </button>
              {currentRole === 'operator' && (
                <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => handleQuickAction('release', contextMenu.date, contextMenu.roomId)}>
                  <Unlock className="w-4 h-4 text-blue-600" /> 临时放量
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
