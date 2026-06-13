import { useState, useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { calculateRevenueSummary } from '../utils/revenueCalculator';
import { CANCEL_FEE_RULES, BENEFIT_DEDUCTION_RULES } from '../utils/refundCalculator';
import { getOrderStatusColor, getOrderStatusName } from '../utils/orderStateMachine';
import type { UserRole } from '../types';
import { AlertTriangle, TrendingUp, DollarSign, FileText, History, AlertCircle, Info, Calendar, Wrench, Lock, AlertOctagon } from 'lucide-react';

export default function DataPanels() {
  const [activeTab, setActiveTab] = useState<'conflicts' | 'revenue' | 'refunds' | 'audit' | 'rules'>('conflicts');
  const { 
    getConflicts, getRevenueForecast, refunds, auditLogs, 
    orders, rooms, maintenances, locks,
    calendarStartDate, calendarEndDate,
    currentRole
  } = useBookingStore();

  const conflicts = useMemo(() => getConflicts(), [getConflicts]);
  
  const revenueForecast = useMemo(() => 
    getRevenueForecast(calendarStartDate, calendarEndDate), 
    [getRevenueForecast, calendarStartDate, calendarEndDate]
  );
  
  const revenueSummary = useMemo(() => 
    calculateRevenueSummary(revenueForecast), 
    [revenueForecast]
  );

  const roleNames: Record<UserRole, string> = {
    host: '房东',
    guest: '住客',
    operator: '运营人员',
  };

  const tabs = [
    { id: 'conflicts', label: '房态冲突', icon: AlertTriangle },
    { id: 'revenue', label: '收入预测', icon: TrendingUp },
    { id: 'refunds', label: '退款流水', icon: DollarSign },
    { id: 'audit', label: '操作审计', icon: History },
    { id: 'rules', label: '规则解释', icon: Info },
  ] as const;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'conflicts' && conflicts.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {conflicts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 h-[400px] overflow-y-auto">
        {activeTab === 'conflicts' && (
          <div className="space-y-3">
            {conflicts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p>当前没有房态冲突</p>
              </div>
            ) : (
              conflicts.map((conflict, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded-lg border ${
                    conflict.severity === 'error' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {conflict.severity === 'error' ? (
                      <AlertOctagon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {conflict.type === 'maintenance_order' && '维修与订单冲突'}
                        {conflict.type === 'lock_order' && '锁房与订单冲突'}
                        {conflict.type === 'order_overlap' && '订单重叠'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{conflict.message}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        关联ID：{conflict.entityIds.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                占用概览
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded p-3 text-center">
                  <Wrench className="w-5 h-5 mx-auto text-red-600 mb-1" />
                  <div className="text-xl font-bold text-red-600">{maintenances.length}</div>
                  <div className="text-xs text-gray-500">维修记录</div>
                </div>
                <div className="bg-white rounded p-3 text-center">
                  <Lock className="w-5 h-5 mx-auto text-purple-600 mb-1" />
                  <div className="text-xl font-bold text-purple-600">
                    {locks.filter(l => !l.releasedAt).length}
                  </div>
                  <div className="text-xs text-gray-500">锁房中</div>
                </div>
                <div className="bg-white rounded p-3 text-center">
                  <FileText className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                  <div className="text-xl font-bold text-blue-600">
                    {orders.filter(o => !['cancelled', 'completed'].includes(o.status)).length}
                  </div>
                  <div className="text-xs text-gray-500">活跃订单</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4">
                <div className="text-xs text-indigo-600 font-medium">预期总收入</div>
                <div className="text-2xl font-bold text-indigo-700 mt-1">¥{revenueSummary.totalExpected.toFixed(0)}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                <div className="text-xs text-green-600 font-medium">实际收入</div>
                <div className="text-2xl font-bold text-green-700 mt-1">¥{revenueSummary.totalActual.toFixed(0)}</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
                <div className="text-xs text-amber-600 font-medium">平均入住率</div>
                <div className="text-2xl font-bold text-amber-700 mt-1">{revenueSummary.avgOccupancy.toFixed(1)}%</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="text-xs text-purple-600 font-medium">平均房价</div>
                <div className="text-2xl font-bold text-purple-700 mt-1">¥{revenueSummary.avgADR.toFixed(0)}</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-2">
              预测周期：{calendarStartDate} 至 {calendarEndDate}（共 {revenueSummary.daysCount} 天）
            </div>

            <div className="space-y-1">
              {revenueForecast.slice(0, 30).map((day, i) => (
                <div key={i} className="flex items-center gap-3 text-sm p-2 hover:bg-gray-50 rounded">
                  <span className="w-24 text-gray-600 flex-shrink-0">{day.date}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden flex">
                    <div 
                      className="h-full bg-green-500" 
                      style={{ width: `${day.occupancyRate}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-gray-500">{day.occupancyRate.toFixed(0)}%</span>
                  <span className="w-24 text-right font-medium">¥{day.actualRevenue.toFixed(0)} / ¥{day.expectedRevenue.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'refunds' && (
          <div className="space-y-3">
            {refunds.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>暂无退款记录</p>
              </div>
            ) : (
              refunds.map(refund => {
                const order = orders.find(o => o.id === refund.orderId);
                const room = rooms.find(r => r.id === order?.roomId);
                return (
                  <div key={refund.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {order?.orderNo} - {room?.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(refund.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${getOrderStatusColor(order?.status || 'cancelled')}`}>
                        {order ? getOrderStatusName(order.status) : '已取消'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                      <div>
                        <div className="text-gray-500">原支付金额</div>
                        <div className="font-medium">¥{refund.amount.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">违约金 ({(refund.cancelFeeRate * 100).toFixed(0)}%)</div>
                        <div className="font-medium text-red-600">-¥{refund.cancelFee.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">实际退款</div>
                        <div className="font-medium text-green-600">¥{refund.refundAmount.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                      <span>原因：{refund.reason}</span>
                      <span>距入住：{refund.daysBeforeCheckin}天</span>
                      {refund.usedBenefits.length > 0 && (
                        <span>优惠抵扣：¥{refund.benefitDeduction.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              }).reverse()
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>暂无操作记录</p>
              </div>
            ) : (
              auditLogs.slice().reverse().slice(0, 50).map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded text-sm">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{log.action}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        log.operatorRole === 'host' ? 'bg-blue-100 text-blue-700' :
                        log.operatorRole === 'operator' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {roleNames[log.operatorRole]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {log.entityType} · {log.entityId} · {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">取消扣费规则</h4>
              <div className="space-y-2">
                {CANCEL_FEE_RULES.map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">{rule.description}</span>
                    <span className={`font-semibold ${
                      rule.feeRate === 0 ? 'text-green-600' :
                      rule.feeRate <= 0.3 ? 'text-yellow-600' :
                      rule.feeRate <= 0.5 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {rule.feeRate === 0 ? '免费' : `扣${rule.feeRate * 100}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">优惠权益扣除规则</h4>
              <div className="space-y-2">
                {Object.entries(BENEFIT_DEDUCTION_RULES).map(([source, rate]) => (
                  <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">
                      {source === 'coupon' ? '优惠券' :
                       source === 'member_discount' ? '会员折扣' :
                       source === 'promotion' ? '促销活动' :
                       source === 'long_stay' ? '长住优惠' : '无优惠'}
                    </span>
                    <span className={`font-semibold ${
                      rate === 0 ? 'text-gray-500' :
                      rate <= 0.3 ? 'text-yellow-600' :
                      rate <= 0.5 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {rate === 0 ? '不扣除' : `扣除${rate * 100}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">价格优先级规则</h4>
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">价格计算顺序（从高到低）：</div>
                  <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
                    <li>节假日特殊价格（最高优先级）</li>
                    <li>价格版本基础价格</li>
                    <li>房间默认基础价格</li>
                    <li>节假日溢价（+30%~50%）</li>
                    <li>周末溢价（+10%~20%）</li>
                    <li>连住折扣（-10%~25%）</li>
                    <li>其他优惠（优惠券、会员折扣等）</li>
                  </ol>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <Info className="w-4 h-4 inline mr-1" />
                  注意：已支付并锁价的订单不受后续价格变动影响；未锁价订单的价格可能随价格版本更新而变化。
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">房态优先级规则</h4>
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">房态判断顺序（从高到低）：</div>
                  <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
                    <li>全天维修 → 不可预订</li>
                    <li>半日维修 → 可接受部分预订</li>
                    <li>已锁房且未放量 → 不可预订</li>
                    <li>已有有效订单 → 不可预订</li>
                    <li>临时放量 → 覆盖锁房状态</li>
                    <li>以上都不是 → 可预订</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
