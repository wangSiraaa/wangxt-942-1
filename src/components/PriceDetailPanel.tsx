import { useState, useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { getDatesForNights, getNightsBetween } from '../utils/dateUtils';
import { calculatePrice } from '../utils/priceCalculator';
import type { BenefitSource } from '../types';
import { Calculator, TrendingUp, Percent, CalendarDays, Info, RefreshCw } from 'lucide-react';

export default function PriceDetailPanel() {
  const { 
    rooms, priceVersions, holidayPrices, longStayDiscounts, 
    selectedRoomIds, selectedDate, currentRole, orders,
    calculatePriceForBooking, batchUpdatePrices
  } = useBookingStore();
  
  const [checkinDate, setCheckinDate] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [benefitSource, setBenefitSource] = useState<BenefitSource>('none');
  const [benefitAmount, setBenefitAmount] = useState(0);
  const [selectedRoomForCalc, setSelectedRoomForCalc] = useState('');
  
  const [batchMode, setBatchMode] = useState(false);
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [batchRoomIds, setBatchRoomIds] = useState<string[]>([]);
  const [adjustmentType, setAdjustmentType] = useState<'fixed' | 'percent'>('percent');
  const [adjustmentValue, setAdjustmentValue] = useState(0);

  const displayedRooms = useMemo(() => {
    if (selectedRoomIds.length > 0) {
      return rooms.filter(r => selectedRoomIds.includes(r.id));
    }
    return rooms;
  }, [rooms, selectedRoomIds]);

  const priceResult = useMemo(() => {
    if (!selectedRoomForCalc || !checkinDate || !checkoutDate || checkinDate >= checkoutDate) {
      return null;
    }
    const room = rooms.find(r => r.id === selectedRoomForCalc);
    if (!room) return null;
    
    return calculatePrice(
      room, checkinDate, checkoutDate, priceVersions, holidayPrices, longStayDiscounts,
      null, benefitSource, benefitAmount
    );
  }, [selectedRoomForCalc, checkinDate, checkoutDate, benefitSource, benefitAmount, rooms, priceVersions, holidayPrices, longStayDiscounts]);

  const activePriceVersions = useMemo(() => {
    return priceVersions.filter(pv => pv.status === 'active');
  }, [priceVersions]);

  const handleBatchUpdate = () => {
    if (batchRoomIds.length === 0 || !batchStartDate || !batchEndDate) {
      alert('请选择房间和日期范围');
      return;
    }
    const result = batchUpdatePrices(batchRoomIds, batchStartDate, batchEndDate, adjustmentValue, adjustmentType);
    if (result.updatedCount > 0) {
      const changes = result.affectedOrders.map(o => 
        `订单 ${o.orderId.slice(-6)}: ¥${o.oldPrice.toFixed(0)} → ¥${o.newPrice.toFixed(0)}`
      ).join('\n');
      alert(`批量价格调整已应用\n\n已自动更新 ${result.updatedCount} 个未锁价订单的价格：\n${changes}`);
    } else {
      alert('批量价格调整已应用\n\n没有需要更新的未锁价订单');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            价格详情
          </h3>
          {currentRole === 'host' && (
            <button
              onClick={() => setBatchMode(!batchMode)}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              {batchMode ? '返回详情' : '批量调整'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {!batchMode ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择房间</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={selectedRoomForCalc}
                  onChange={(e) => setSelectedRoomForCalc(e.target.value)}
                >
                  <option value="">请选择房间</option>
                  {displayedRooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} - ¥{r.basePrice}/晚</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">入住日期</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={checkinDate}
                  onChange={(e) => setCheckinDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退房日期</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={checkoutDate}
                  onChange={(e) => setCheckoutDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">优惠类型</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={benefitSource}
                  onChange={(e) => setBenefitSource(e.target.value as BenefitSource)}
                >
                  <option value="none">无优惠</option>
                  <option value="coupon">优惠券</option>
                  <option value="member_discount">会员折扣</option>
                  <option value="promotion">促销活动</option>
                  <option value="long_stay">长住优惠</option>
                </select>
              </div>
              {benefitSource !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">优惠金额</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={benefitAmount}
                    onChange={(e) => setBenefitAmount(Number(e.target.value))}
                    placeholder="输入优惠金额"
                  />
                </div>
              )}
            </div>

            {priceResult && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <CalendarDays className="w-4 h-4" />
                    共 {getNightsBetween(checkinDate, checkoutDate)} 晚
                  </span>
                  <span className="text-sm text-gray-600">
                    {checkinDate} 至 {checkoutDate}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">基础房价</span>
                    <span>¥{priceResult.basePrice.toFixed(2)}</span>
                  </div>
                  {priceResult.holidayPremium > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> 节假日溢价
                      </span>
                      <span className="text-red-600">+¥{priceResult.holidayPremium.toFixed(2)}</span>
                    </div>
                  )}
                  {priceResult.weekendPremium > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> 周末溢价
                      </span>
                      <span className="text-orange-600">+¥{priceResult.weekendPremium.toFixed(2)}</span>
                    </div>
                  )}
                  {priceResult.longStayDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <Percent className="w-4 h-4" /> 连住折扣
                      </span>
                      <span className="text-green-600">-¥{priceResult.longStayDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {priceResult.benefitAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600 flex items-center gap-1">
                        <Percent className="w-4 h-4" /> {priceResult.benefitSource}
                      </span>
                      <span className="text-blue-600">-¥{priceResult.benefitAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="font-medium text-gray-900">总价</span>
                  <span className="text-2xl font-bold text-indigo-600">¥{priceResult.totalPrice.toFixed(2)}</span>
                </div>

                <div className="bg-white rounded p-3 text-xs space-y-1">
                  <div className="font-medium text-gray-700 mb-2">每日明细：</div>
                  {priceResult.dailyBreakdown.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-600">{item.date}</span>
                      <span className="text-gray-900">¥{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-1">
                <Info className="w-4 h-4" />
                当前价格版本
              </h4>
              <div className="space-y-2">
                {activePriceVersions.map(pv => {
                  const room = rooms.find(r => r.id === pv.roomId);
                  return (
                    <div key={pv.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{room?.name} - {pv.name}</span>
                        <span className="text-green-600">已激活</span>
                      </div>
                      <div className="text-gray-600 mt-1">
                        {pv.startDate} 至 {pv.endDate}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span>基础价：¥{pv.basePrice}</span>
                        <span className="text-orange-600">周末+{pv.weekendPremium * 100}%</span>
                        <span className="text-red-600">节假日+{pv.holidayPremium * 100}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {longStayDiscounts.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">连住折扣规则</h4>
                <div className="grid grid-cols-2 gap-2">
                  {longStayDiscounts.map(d => {
                    const room = rooms.find(r => r.id === d.roomId);
                    return (
                      <div key={d.id} className="bg-green-50 rounded-lg p-3 text-sm">
                        <div className="font-medium text-green-800">{room?.name}</div>
                        <div className="text-green-700">
                          住{d.minNights}-{d.maxNights}晚 减{d.discountPercent}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <Info className="w-4 h-4 inline mr-1" />
              批量价格调整将修改所选房间在指定日期范围内的节假日价格。
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择房间</label>
                <div className="flex flex-wrap gap-2">
                  {displayedRooms.map(r => (
                    <label key={r.id} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={batchRoomIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBatchRoomIds([...batchRoomIds, r.id]);
                          } else {
                            setBatchRoomIds(batchRoomIds.filter(id => id !== r.id));
                          }
                        }}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={batchStartDate}
                    onChange={(e) => setBatchStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={batchEndDate}
                    onChange={(e) => setBatchEndDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">调整方式</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as 'fixed' | 'percent')}
                  >
                    <option value="percent">百分比调整</option>
                    <option value="fixed">固定金额调整</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">调整值</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                    placeholder={adjustmentType === 'percent' ? '如：10 表示涨价10%' : '如：50 表示涨价50元'}
                  />
                </div>
              </div>
              
              <button
                onClick={handleBatchUpdate}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                应用批量调整
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
