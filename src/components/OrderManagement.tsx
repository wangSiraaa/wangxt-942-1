import { useState, useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { getOrderStatusName, getOrderStatusColor, checkStateTransition, processOrderCancellation, processPartialCancellation, canReschedule, canPartialCancel, canLockPrice, canModifyPrice } from '../utils/orderStateMachine';
import { getNightsBetween, getToday, addDays } from '../utils/dateUtils';
import { calculatePrice } from '../utils/priceCalculator';
import type { OrderStatus, RefundReason } from '../types';
import { FileText, Plus, Clock, DollarSign, Edit3, Trash2, RefreshCw, Lock, Unlock, CheckCircle, XCircle, AlertTriangle, ArrowRight, Calendar, TrendingUp, TrendingDown, Info } from 'lucide-react';

export default function OrderManagement() {
  const { 
    orders, rooms, priceVersions, holidayPrices, longStayDiscounts, refunds,
    selectedOrderId, setSelectedOrderId, currentRole,
    createOrder, updateOrderStatus, payOrder, lockOrderPrice, cancelOrder, partialCancelOrder, rescheduleOrder,
    getAvailability, calculateRefundForOrder, getDynamicOrderPrice
  } = useBookingStore();

  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({
    roomId: '',
    guestName: '',
    guestPhone: '',
    checkinDate: '',
    checkoutDate: '',
    guestCount: 2,
  });
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [showReschedule, setShowReschedule] = useState<string | null>(null);
  const [rescheduleDates, setRescheduleDates] = useState({ checkin: '', checkout: '' });
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<RefundReason>('guest_cancel');
  const [partialNights, setPartialNights] = useState(1);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, statusFilter]);

  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const orderRefunds = useMemo(() => {
    if (!selectedOrderId) return [];
    return refunds.filter(r => r.orderId === selectedOrderId);
  }, [refunds, selectedOrderId]);

  const pricePreview = useMemo(() => {
    if (!newOrder.roomId || !newOrder.checkinDate || !newOrder.checkoutDate || newOrder.checkinDate >= newOrder.checkoutDate) {
      return null;
    }
    const room = rooms.find(r => r.id === newOrder.roomId);
    if (!room) return null;
    return calculatePrice(room, newOrder.checkinDate, newOrder.checkoutDate, priceVersions, holidayPrices, longStayDiscounts);
  }, [newOrder, rooms, priceVersions, holidayPrices, longStayDiscounts]);

  const availabilityCheck = useMemo(() => {
    if (!newOrder.roomId || !newOrder.checkinDate || !newOrder.checkoutDate) return null;
    return getAvailability(newOrder.roomId, newOrder.checkinDate, newOrder.checkoutDate);
  }, [newOrder.roomId, newOrder.checkinDate, newOrder.checkoutDate, getAvailability]);

  const refundPreview = useMemo(() => {
    if (!showCancelModal) return null;
    return calculateRefundForOrder(showCancelModal, cancelReason);
  }, [showCancelModal, cancelReason, calculateRefundForOrder]);

  const handleCreateOrder = () => {
    if (!pricePreview) return;
    if (availabilityCheck && !availabilityCheck.available) {
      alert('所选日期不可预订：' + availabilityCheck.conflicts.join(', '));
      return;
    }
    
    createOrder({
      roomId: newOrder.roomId,
      guestId: 'guest_new',
      guestName: newOrder.guestName,
      guestPhone: newOrder.guestPhone,
      checkinDate: newOrder.checkinDate,
      checkoutDate: newOrder.checkoutDate,
      guestCount: newOrder.guestCount,
      priceSnapshot: {
        basePrice: pricePreview.basePrice,
        holidayPremium: pricePreview.holidayPremium,
        weekendPremium: pricePreview.weekendPremium,
        longStayDiscount: pricePreview.longStayDiscount,
        otherDiscounts: pricePreview.otherDiscounts,
        totalPrice: pricePreview.totalPrice,
        benefitSource: pricePreview.benefitSource,
        benefitAmount: pricePreview.benefitAmount,
      },
      paidAmount: 0,
    });
    
    setShowNewOrder(false);
    setNewOrder({ roomId: '', guestName: '', guestPhone: '', checkinDate: '', checkoutDate: '', guestCount: 2 });
  };

  const handleStatusAction = (orderId: string, action: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const check = checkStateTransition(order.status, action, currentRole);
    if (!check.allowed) {
      alert(check.reason || '不允许此操作');
      return;
    }

    switch (action) {
      case 'confirm':
        updateOrderStatus(orderId, 'confirmed');
        break;
      case 'pay':
        payOrder(orderId, order.priceSnapshot.totalPrice);
        break;
      case 'lock':
        lockOrderPrice(orderId);
        break;
      case 'checkin':
        updateOrderStatus(orderId, 'checkin');
        break;
      case 'checkout':
        updateOrderStatus(orderId, 'checkout');
        updateOrderStatus(orderId, 'completed');
        break;
      case 'cancel':
        setShowCancelModal(orderId);
        break;
      case 'partial_cancel':
        setShowCancelModal(orderId);
        break;
      case 'restore':
        updateOrderStatus(orderId, 'confirmed');
        break;
    }
  };

  const handleConfirmCancel = () => {
    if (!showCancelModal) return;
    const order = orders.find(o => o.id === showCancelModal);
    if (!order) return;

    if (cancelReason === 'partial_cancel' && canPartialCancel(order)) {
      const totalNights = getNightsBetween(order.checkinDate, order.checkoutDate);
      const safeCancelNights = Math.min(partialNights, totalNights - 1);
      const cancelCheckin = addDays(order.checkoutDate, -safeCancelNights);
      partialCancelOrder(showCancelModal, safeCancelNights, cancelCheckin, order.checkoutDate, cancelReason);
    } else {
      cancelOrder(showCancelModal, cancelReason);
    }
    
    setShowCancelModal(null);
    setCancelReason('guest_cancel');
  };

  const handleReschedule = (orderId: string) => {
    if (!rescheduleDates.checkin || !rescheduleDates.checkout) {
      alert('请选择新的日期');
      return;
    }
    
    const avail = getAvailability(
      orders.find(o => o.id === orderId)?.roomId || '',
      rescheduleDates.checkin,
      rescheduleDates.checkout
    );
    
    if (!avail.available) {
      alert('所选日期不可预订：' + avail.conflicts.join(', '));
      return;
    }
    
    rescheduleOrder(orderId, rescheduleDates.checkin, rescheduleDates.checkout);
    setShowReschedule(null);
    setRescheduleDates({ checkin: '', checkout: '' });
  };

  const getNextActions = (order: typeof orders[0]) => {
    return checkStateTransition(order.status, '', currentRole).nextStates.filter(
      t => t.allowedRoles.includes(currentRole)
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            订单管理
          </h3>
          <div className="flex items-center gap-3">
            <select
              className="text-sm border rounded-lg px-3 py-1.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
            >
              <option value="all">全部订单</option>
              <option value="pending">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="paid">已支付</option>
              <option value="locked">已锁价</option>
              <option value="checkin">入住中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="partially_cancelled">部分取消</option>
            </select>
            {currentRole !== 'guest' && (
              <button
                onClick={() => setShowNewOrder(true)}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                新建订单
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[600px]">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {filteredOrders.map(order => {
              const room = rooms.find(r => r.id === order.roomId);
              return (
                <div
                  key={order.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrderId === order.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{order.orderNo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getOrderStatusColor(order.status)}`}>
                          {getOrderStatusName(order.status)}
                        </span>
                        {order.lockedPrice && (
                          <Lock className="w-3 h-3 text-purple-600" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {room?.name} · {order.guestName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {order.checkinDate} → {order.checkoutDate}
                        <span className="ml-2">
                          {getNightsBetween(order.checkinDate, order.checkoutDate)}晚
                        </span>
                      </div>
                    </div>
                    {(() => {
                      const priceInfo = getDynamicOrderPrice(order.id);
                      const displayPrice = priceInfo.isLocked ? priceInfo.snapshotPrice : priceInfo.currentPrice;
                      return (
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`font-semibold ${priceInfo.isLocked ? 'text-gray-600' : 'text-indigo-600'}`}>
                              ¥{displayPrice.totalPrice.toFixed(0)}
                            </span>
                            {priceInfo.isLocked ? (
                              <span title="已锁价，不受价格变动影响">
                                <Lock className="w-3 h-3 text-purple-600" />
                              </span>
                            ) : (
                              <span title="未锁价，价格可能变动">
                                <Unlock className="w-3 h-3 text-amber-500" />
                              </span>
                            )}
                          </div>
                          {priceInfo.priceChanged && !priceInfo.isLocked && (
                            <div className={`text-xs flex items-center justify-end gap-0.5 ${
                              priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice 
                                ? 'text-red-500' 
                                : 'text-green-500'
                            }`}>
                              {priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice ? (
                                <><TrendingUp className="w-3 h-3" /> 较原价涨 ¥{(priceInfo.currentPrice.totalPrice - priceInfo.snapshotPrice.totalPrice).toFixed(0)}</>
                              ) : (
                                <><TrendingDown className="w-3 h-3" /> 较原价降 ¥{(priceInfo.snapshotPrice.totalPrice - priceInfo.currentPrice.totalPrice).toFixed(0)}</>
                              )}
                            </div>
                          )}
                          {!priceInfo.isLocked && !priceInfo.priceChanged && (
                            <div className="text-xs text-amber-500">
                              价格待确认
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            已付 ¥{order.paidAmount.toFixed(0)}
                            {order.paidAmount > 0 && !priceInfo.isLocked && (
                              <span className="text-purple-500 ml-1">（已付锁价）</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {selectedOrderId === order.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getNextActions(order).map(action => (
                        <button
                          key={action.action}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusAction(order.id, action.action);
                          }}
                          className={`px-3 py-1 text-xs rounded-lg ${
                            action.action === 'cancel' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                            action.action === 'partial_cancel' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                            'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          }`}
                        >
                          {action.description}
                        </button>
                      ))}
                      {canReschedule(order) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReschedule(showReschedule === order.id ? null : order.id);
                          }}
                          className="px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          <RefreshCw className="w-3 h-3 inline mr-1" />
                          改期
                        </button>
                      )}
                    </div>
                  )}

                  {showReschedule === order.id && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-800 mb-2">选择新日期</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="date"
                          className="text-sm border rounded px-2 py-1"
                          value={rescheduleDates.checkin}
                          onChange={(e) => setRescheduleDates(d => ({ ...d, checkin: e.target.value }))}
                          placeholder="新入住日期"
                        />
                        <input
                          type="date"
                          className="text-sm border rounded px-2 py-1"
                          value={rescheduleDates.checkout}
                          onChange={(e) => setRescheduleDates(d => ({ ...d, checkout: e.target.value }))}
                          placeholder="新退房日期"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReschedule(order.id);
                          }}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
                        >
                          确认改期
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReschedule(null);
                          }}
                          className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredOrders.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                暂无订单数据
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 p-4 overflow-y-auto">
          {selectedOrder ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">{selectedOrder.orderNo}</h4>
                <span className={`px-3 py-1 text-sm rounded ${getOrderStatusColor(selectedOrder.status)}`}>
                  {getOrderStatusName(selectedOrder.status)}
                </span>
              </div>

              {(() => {
                const priceInfo = getDynamicOrderPrice(selectedOrder.id);
                const canModify = canModifyPrice(selectedOrder);
                const displayPrice = priceInfo.isLocked ? priceInfo.snapshotPrice : priceInfo.currentPrice;
                
                return (
                  <>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">房间</span>
                        <span className="font-medium">{rooms.find(r => r.id === selectedOrder.roomId)?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">入住人</span>
                        <span className="font-medium">{selectedOrder.guestName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">联系电话</span>
                        <span className="font-medium">{selectedOrder.guestPhone}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">入住日期</span>
                        <span className="font-medium">{selectedOrder.checkinDate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">退房日期</span>
                        <span className="font-medium">{selectedOrder.checkoutDate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">入住人数</span>
                        <span className="font-medium">{selectedOrder.guestCount}人</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">价格锁定</span>
                        <span className="font-medium flex items-center gap-1">
                          {priceInfo.isLocked ? <Lock className="w-4 h-4 text-purple-600" /> : <Unlock className="w-4 h-4 text-amber-500" />}
                          {priceInfo.isLocked ? '已锁定' : '未锁定'}
                        </span>
                      </div>
                      {!priceInfo.isLocked && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <div className="text-xs text-amber-800 flex items-start gap-1">
                            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-medium">价格未锁定</div>
                              <div className="mt-1">价格可能随节假日、连住折扣等因素变动。确认付款后价格将锁定。</div>
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedOrder.rescheduledFrom && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">改期记录</span>
                          <span className="text-orange-600">有改期历史</span>
                        </div>
                      )}
                    </div>

                    {!priceInfo.isLocked && priceInfo.priceChanged && (
                      <div className={`rounded-lg p-4 border ${
                        priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="text-sm font-medium mb-2 flex items-center gap-1">
                          {priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice ? (
                            <><TrendingUp className="w-4 h-4" /> 价格已上涨</>
                          ) : (
                            <><TrendingDown className="w-4 h-4" /> 价格已下降</>
                          )}
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span>原价（下单时）</span>
                            <span className="font-medium">¥{priceInfo.snapshotPrice.totalPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>当前价</span>
                            <span className={`font-medium ${
                              priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              ¥{priceInfo.currentPrice.totalPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 mt-1">
                            <span>差额</span>
                            <span className={`font-medium ${
                              priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}>
                              {priceInfo.currentPrice.totalPrice > priceInfo.snapshotPrice.totalPrice ? '+' : ''}
                              ¥{(priceInfo.currentPrice.totalPrice - priceInfo.snapshotPrice.totalPrice).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={`rounded-lg p-4 ${
                      priceInfo.isLocked ? 'bg-gray-100' : 'bg-indigo-50'
                    }`}>
                      <h5 className={`font-medium mb-3 flex items-center gap-1 ${
                        priceInfo.isLocked ? 'text-gray-700' : 'text-indigo-900'
                      }`}>
                        <DollarSign className="w-4 h-4" />
                        价格明细{priceInfo.isLocked ? '（已锁定）' : '（当前计算）'}
                      </h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">基础房价</span>
                          <span>¥{displayPrice.basePrice.toFixed(2)}</span>
                        </div>
                        {displayPrice.holidayPremium > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>节假日溢价</span>
                            <span>+¥{displayPrice.holidayPremium.toFixed(2)}</span>
                          </div>
                        )}
                        {displayPrice.weekendPremium > 0 && (
                          <div className="flex justify-between text-orange-600">
                            <span>周末溢价</span>
                            <span>+¥{displayPrice.weekendPremium.toFixed(2)}</span>
                          </div>
                        )}
                        {displayPrice.longStayDiscount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>连住折扣</span>
                            <span>-¥{displayPrice.longStayDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {displayPrice.benefitAmount > 0 && (
                          <div className="flex justify-between text-blue-600">
                            <span>{displayPrice.benefitSource}</span>
                            <span>-¥{displayPrice.benefitAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className={`border-t pt-2 flex justify-between font-semibold ${
                          priceInfo.isLocked ? 'border-gray-300' : 'border-indigo-200'
                        }`}>
                          <span>总价</span>
                          <span className="text-xl">¥{displayPrice.totalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {!priceInfo.isLocked && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <div className="text-xs text-purple-800">
                          <div className="font-medium mb-1">💡 价格锁定说明</div>
                          <ul className="space-y-0.5 text-purple-700">
                            <li>• 已付款订单：价格自动锁定，不受后续价格变更影响</li>
                            <li>• 已锁价订单：使用锁定时的价格快照</li>
                            <li>• 未锁价订单：按当前最新价格动态计算</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-600">已支付</span>
                  <span className="text-green-600 font-medium">¥{selectedOrder.paidAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">待支付</span>
                  <span className="text-orange-600 font-medium">¥{Math.max(0, (getDynamicOrderPrice(selectedOrder.id).isLocked ? getDynamicOrderPrice(selectedOrder.id).snapshotPrice.totalPrice : getDynamicOrderPrice(selectedOrder.id).currentPrice.totalPrice) - selectedOrder.paidAmount).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-3">订单状态机</h5>
                <div className="flex flex-wrap gap-2 items-center">
                  {['pending', 'confirmed', 'paid', 'locked', 'checkin', 'checkout', 'completed', 'cancelled'].map((status, i) => (
                    <div key={status} className="flex items-center">
                      <div className={`px-2 py-1 text-xs rounded ${
                        selectedOrder.status === status 
                          ? 'bg-indigo-600 text-white' 
                          : ['pending', 'confirmed', 'paid', 'locked', 'checkin', 'checkout', 'completed', 'cancelled'].indexOf(selectedOrder.status) > i
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-500'
                      }`}>
                        {getOrderStatusName(status as OrderStatus)}
                      </div>
                      {i < 7 && <ArrowRight className="w-4 h-4 text-gray-400 mx-1" />}
                    </div>
                  ))}
                </div>
              </div>

              {orderRefunds.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h5 className="font-medium text-red-900 mb-3">退款记录</h5>
                  <div className="space-y-2">
                    {orderRefunds.map(refund => (
                      <div key={refund.id} className="text-sm bg-white rounded p-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">退款原因</span>
                          <span>{refund.reason}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">违约金比例</span>
                          <span>{(refund.cancelFeeRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">违约金</span>
                          <span className="text-red-600">¥{refund.cancelFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">优惠抵扣</span>
                          <span className="text-orange-600">¥{refund.benefitDeduction.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t mt-2">
                          <span>实际退款</span>
                          <span className="text-green-600">¥{refund.refundAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              请选择订单查看详情
            </div>
          )}
        </div>
      </div>

      {showNewOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">新建订单</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择房间</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={newOrder.roomId}
                  onChange={(e) => setNewOrder(o => ({ ...o, roomId: e.target.value }))}
                >
                  <option value="">请选择房间</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} - ¥{r.basePrice}/晚</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入住日期</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={newOrder.checkinDate}
                    onChange={(e) => setNewOrder(o => ({ ...o, checkinDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">退房日期</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={newOrder.checkoutDate}
                    onChange={(e) => setNewOrder(o => ({ ...o, checkoutDate: e.target.value }))}
                  />
                </div>
              </div>

              {availabilityCheck && !availabilityCheck.available && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  所选日期不可预订：
                  <ul className="mt-1 ml-5 list-disc">
                    {availabilityCheck.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {pricePreview && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">共 {getNightsBetween(newOrder.checkinDate, newOrder.checkoutDate)} 晚</span>
                    <span className="font-semibold text-indigo-600">¥{pricePreview.totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {pricePreview.dailyBreakdown.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{d.date}</span>
                        <span>¥{d.price.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入住人姓名</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={newOrder.guestName}
                    onChange={(e) => setNewOrder(o => ({ ...o, guestName: e.target.value }))}
                    placeholder="请输入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={newOrder.guestPhone}
                    onChange={(e) => setNewOrder(o => ({ ...o, guestPhone: e.target.value }))}
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
                  value={newOrder.guestCount}
                  onChange={(e) => setNewOrder(o => ({ ...o, guestCount: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewOrder(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={!pricePreview || (availabilityCheck && !availabilityCheck.available)}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                创建订单
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[450px]">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              取消订单
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">取消原因</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value as RefundReason)}
                >
                  <option value="guest_cancel">客人取消</option>
                  <option value="host_cancel">房东取消</option>
                  <option value="maintenance">维修原因</option>
                  <option value="system">系统原因</option>
                  {canPartialCancel(orders.find(o => o.id === showCancelModal)!) && (
                    <option value="partial_cancel">部分取消</option>
                  )}
                </select>
              </div>

              {cancelReason === 'partial_cancel' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">取消晚数</label>
                  <input
                    type="number"
                    min="1"
                    max={getNightsBetween(
                      orders.find(o => o.id === showCancelModal)!.checkinDate,
                      orders.find(o => o.id === showCancelModal)!.checkoutDate
                    ) - 1}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={partialNights}
                    onChange={(e) => setPartialNights(Number(e.target.value))}
                  />
                </div>
              )}

              {refundPreview && (
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <h5 className="font-medium text-gray-900 mb-3">退款计算明细</h5>
                  <div className="space-y-2">
                    {refundPreview.calculationSteps.map((step, i) => (
                      <div key={i} className="text-gray-600">{step}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCancelModal(null);
                  setCancelReason('guest_cancel');
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                确认取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
