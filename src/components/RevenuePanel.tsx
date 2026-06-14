import { useState, useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import type { PricingSuggestion, PricingSuggestionType, HistoricalOccupancyRecord, ChannelConfig } from '../types';
import {
  TrendingUp, TrendingDown, Minus, Zap, Calendar as CalendarIcon,
  BarChart3, Clock, ShieldAlert, Sparkles, CheckCircle, XCircle,
  Users, Wrench, Home, ArrowUpRight, ArrowDownRight, Settings2, RefreshCw
} from 'lucide-react';

const suggestionTypeConfig: Record<PricingSuggestionType, { label: string; color: string; bg: string; icon: any }> = {
  raise: { label: '建议涨价', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', icon: TrendingUp },
  lower: { label: '建议降价', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: TrendingDown },
  hold: { label: '建议保持', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: Minus },
  restrict: { label: '建议限售', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: ShieldAlert },
};

const factorLabels: Record<string, string> = {
  holiday: '节假日因子',
  weekend: '周末因子',
  maintenance_risk: '维修风险因子',
  cleaning_capacity: '清洁人力因子',
  historical_occupancy: '历史入住率因子',
  competitor_price: '竞品价格因子',
  demand_forecast: '需求预测因子',
};

const factorColors: Record<string, string> = {
  holiday: 'bg-red-500',
  weekend: 'bg-orange-500',
  maintenance_risk: 'bg-purple-500',
  cleaning_capacity: 'bg-amber-500',
  historical_occupancy: 'bg-blue-500',
  competitor_price: 'bg-teal-500',
  demand_forecast: 'bg-indigo-500',
};

export default function RevenuePanel() {
  const {
    pricingSuggestions, rooms, historicalOccupancies, channelConfigs,
    applySinglePricingSuggestion, rejectPricingSuggestion,
    generatePricingSuggestions, getPricingSuggestions, currentRole, selectedRoomIds,
    getExceptionStatsSummary, validatePriceAdjustmentParams, protectedBatchUpdatePrices,
  } = useBookingStore();

  const [activeTab, setActiveTab] = useState<'suggestions' | 'history' | 'channels' | 'batch'>('suggestions');
  const [filterRoomId, setFilterRoomId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [batchMode, setBatchMode] = useState(false);
  const [batchAdjust, setBatchAdjust] = useState({ type: 'percent' as 'percent' | 'absolute', value: 0 });
  const [batchStart, setBatchStart] = useState('');
  const [batchEnd, setBatchEnd] = useState('');
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const displayedRooms = useMemo(() => {
    if (filterRoomId === 'all') return rooms;
    return rooms.filter(r => r.id === filterRoomId);
  }, [rooms, filterRoomId]);

  const filteredSuggestions = useMemo(() => {
    return pricingSuggestions.filter(s => {
      if (filterRoomId !== 'all' && s.roomId !== filterRoomId) return false;
      if (filterType !== 'all' && s.suggestionType !== filterType) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => b.confidenceScore - a.confidenceScore);
  }, [pricingSuggestions, filterRoomId, filterType, filterStatus]);

  const suggestionStats = useMemo(() => {
    const stats = { total: pricingSuggestions.length, pending: 0, applied: 0, rejected: 0, expired: 0, avgConfidence: 0 };
    pricingSuggestions.forEach(s => {
      if (s.status === 'pending') stats.pending++;
      else if (s.status === 'applied') stats.applied++;
      else if (s.status === 'rejected') stats.rejected++;
      else stats.expired++;
      stats.avgConfidence += s.confidenceScore;
    });
    if (stats.total > 0) stats.avgConfidence = Math.round(stats.avgConfidence / stats.total);
    return stats;
  }, [pricingSuggestions]);

  const occupancyTrend = useMemo(() => {
    const roomIds = displayedRooms.map(r => r.id);
    const filtered = historicalOccupancies.filter(h => roomIds.includes(h.roomId));
    if (filtered.length === 0) return [];
    const byDate = new Map<string, { total: number; count: number; revenue: number; adr: number }>();
    filtered.forEach(h => {
      if (!byDate.has(h.date)) byDate.set(h.date, { total: 0, count: 0, revenue: 0, adr: 0 });
      const d = byDate.get(h.date)!;
      d.total += h.occupancyRate;
      d.revenue += h.revenue;
      d.adr += h.avgDailyRate;
      d.count++;
    });
    const result = Array.from(byDate.entries()).map(([date, v]) => ({
      date,
      avgOccupancy: Math.round(v.total / v.count),
      totalRevenue: Math.round(v.revenue),
      avgAdr: Math.round(v.adr / v.count),
    })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    return result;
  }, [historicalOccupancies, displayedRooms]);

  const channelSummary = useMemo(() => {
    const byChannel = new Map<string, { total: number; enabled: number; avgCommission: number; minPriceSum: number; maxPriceSum: number }>();
    channelConfigs.forEach(c => {
      if (!byChannel.has(c.channel)) byChannel.set(c.channel, { total: 0, enabled: 0, avgCommission: 0, minPriceSum: 0, maxPriceSum: 0 });
      const d = byChannel.get(c.channel)!;
      d.total++;
      if (c.enabled) d.enabled++;
      d.avgCommission += c.commissionRate;
      d.minPriceSum += c.minPrice || 0;
      d.maxPriceSum += c.maxPrice || 0;
    });
    const channelNames: Record<string, string> = { direct: '直销', ota: 'OTA平台', corporate_longstay: '企业长租', event_buyout: '临时包栋' };
    return Array.from(byChannel.entries()).map(([channel, v]) => ({
      channel,
      name: channelNames[channel] || channel,
      totalRooms: v.total,
      enabledRooms: v.enabled,
      avgCommission: v.total > 0 ? Math.round((v.avgCommission / v.total) * 100) + '%' : '-',
      avgMinPrice: v.enabled > 0 ? Math.round(v.minPriceSum / v.enabled) : 0,
      avgMaxPrice: v.enabled > 0 ? Math.round(v.maxPriceSum / v.enabled) : 0,
    }));
  }, [channelConfigs]);

  const handleGenerateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      generatePricingSuggestions(displayedRooms.map(r => r.id), today, nextMonth);
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
  };

  const handleBatchUpdate = () => {
    if (!batchStart || !batchEnd) {
      alert('请选择批量调价的日期范围');
      return;
    }
    const currentAvgPrice = displayedRooms.length > 0
      ? displayedRooms.reduce((sum, r) => sum + r.basePrice, 0) / displayedRooms.length
      : 300;
    const validation = validatePriceAdjustmentParams(batchAdjust.value, batchAdjust.type === 'absolute' ? 'fixed' : batchAdjust.type, currentAvgPrice);
    if (!validation.valid) {
      alert('调价参数错误: ' + validation.reason);
      return;
    }
    const result = protectedBatchUpdatePrices(
      displayedRooms.map(r => r.id), batchStart, batchEnd, batchAdjust.value, batchAdjust.type === 'absolute' ? 'fixed' : batchAdjust.type
    );
    setBatchResult(result);
  };

  const exceptionStats = getExceptionStatsSummary();

  const tabs = [
    { id: 'suggestions', label: '调价建议', icon: Sparkles, badge: suggestionStats.pending > 0 ? suggestionStats.pending : null },
    { id: 'history', label: '历史分析', icon: BarChart3 },
    { id: 'channels', label: '渠道库存池', icon: Settings2, badge: channelSummary.reduce((a, b) => a + b.enabledRooms, 0) || null },
    { id: 'batch', label: '批量调价', icon: Zap },
  ] as const;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-900">收益管理中心</h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-gray-600">待处理建议: <b className="text-emerald-600">{suggestionStats.pending}</b></span>
            </div>
            <div className="h-3 w-px bg-gray-300" />
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-gray-600">已采纳: <b className="text-blue-600">{suggestionStats.applied}</b></span>
            </div>
            <div className="h-3 w-px bg-gray-300" />
            <div className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-gray-600">异常项: <b className="text-rose-600">{exceptionStats?.critical || 0 + exceptionStats?.warning || 0}</b></span>
            </div>
          </div>
        </div>
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {'badge' in tab && tab.badge !== null && tab.badge !== undefined && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[420px] overflow-y-auto">
        {activeTab === 'suggestions' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="text-sm border border-gray-300 rounded px-2 py-1.5"
                  value={filterRoomId}
                  onChange={e => setFilterRoomId(e.target.value)}
                >
                  <option value="all">全部房间</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select
                  className="text-sm border border-gray-300 rounded px-2 py-1.5"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="all">全部建议类型</option>
                  <option value="raise">建议涨价</option>
                  <option value="lower">建议降价</option>
                  <option value="hold">建议保持</option>
                  <option value="restrict">建议限售</option>
                </select>
                <select
                  className="text-sm border border-gray-300 rounded px-2 py-1.5"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="applied">已采纳</option>
                  <option value="rejected">已拒绝</option>
                  <option value="expired">已过期</option>
                </select>
              </div>
              <button
                onClick={handleGenerateSuggestions}
                disabled={isGenerating || currentRole === 'guest'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? '生成中...' : '生成调价建议'}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="text-xs text-indigo-600">建议总数</div>
                <div className="text-xl font-bold text-indigo-700 mt-0.5">{suggestionStats.total}</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-xs text-amber-600">待处理</div>
                <div className="text-xl font-bold text-amber-700 mt-0.5">{suggestionStats.pending}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-xs text-emerald-600">已采纳</div>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">{suggestionStats.applied}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600">平均置信度</div>
                <div className="text-xl font-bold text-gray-700 mt-0.5">{suggestionStats.avgConfidence}%</div>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredSuggestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">暂无匹配的调价建议</p>
                  <p className="text-xs text-gray-400 mt-1">点击"生成调价建议"按钮基于AI分析创建</p>
                </div>
              ) : (
                filteredSuggestions.slice(0, 15).map(s => {
                  const room = rooms.find(r => r.id === s.roomId);
                  const cfg = suggestionTypeConfig[s.suggestionType];
                  const Icon = cfg.icon;
                  return (
                    <div key={s.id} className={`border rounded-lg p-3 ${cfg.bg} ${s.status !== 'pending' ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg bg-white ${cfg.color} flex-shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                              <span className="text-xs text-gray-500 bg-white/50 px-1.5 py-0.5 rounded">
                                {room?.name || '未知房间'}
                              </span>
                              <span className="text-xs text-gray-500 bg-white/50 px-1.5 py-0.5 rounded">
                                <CalendarIcon className="w-3 h-3 inline" /> {s.date}
                              </span>
                              {s.status === 'applied' && (
                                <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <CheckCircle className="w-3 h-3" />已采纳
                                </span>
                              )}
                              {s.status === 'rejected' && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <XCircle className="w-3 h-3" />已拒绝
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">当前:</span>
                                <span className="font-medium">¥{s.currentPrice}</span>
                              </div>
                              <ArrowUpRight className={`w-4 h-4 ${s.suggestionType === 'raise' ? 'text-rose-500' : s.suggestionType === 'lower' ? 'text-emerald-500 rotate-180' : 'text-gray-400'}`} />
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">建议:</span>
                                <span className={`font-bold ${cfg.color}`}>¥{s.suggestedPrice}</span>
                              </div>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                s.adjustmentPercent > 0 ? 'bg-rose-100 text-rose-700' :
                                s.adjustmentPercent < 0 ? 'bg-emerald-100 text-emerald-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {s.adjustmentPercent > 0 ? '+' : ''}{s.adjustmentPercent}%
                              </span>
                              <span className="text-xs text-gray-500 ml-auto flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-500" />
                                置信度 {s.confidenceScore}%
                              </span>
                            </div>
                            <div className="mt-2.5 space-y-1.5">
                              <div className="text-xs text-gray-600 font-medium">{s.rationale}</div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {s.factors.map((f, i) => (
                                  <div key={i} className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded text-xs">
                                    <div className={`w-2 h-2 rounded-full ${factorColors[f.factor] || 'bg-gray-400'}`} />
                                    <span className="text-gray-600">{factorLabels[f.factor] || f.factor}</span>
                                    <span className={`font-medium ${f.value > 0 ? 'text-rose-600' : f.value < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                      {f.value > 0 ? '+' : ''}{(f.value * 100).toFixed(0)}%
                                    </span>
                                    <span className="text-gray-400">w{f.weight}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        {s.status === 'pending' && currentRole !== 'guest' && (
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => applySinglePricingSuggestion(s.id)}
                              className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />采纳
                            </button>
                            <button
                              onClick={() => rejectPricingSuggestion(s.id)}
                              className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />拒绝
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {filteredSuggestions.length > 15 && (
                <div className="text-center text-xs text-gray-400 pt-2">
                  共 {filteredSuggestions.length} 条建议，仅显示前15条
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={filterRoomId}
                onChange={e => setFilterRoomId(e.target.value)}
              >
                <option value="all">全部房间</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />平均入住率
                </div>
                <div className="text-2xl font-bold text-blue-700 mt-1">
                  {occupancyTrend.length > 0 ? Math.round(occupancyTrend.reduce((a, b) => a + b.avgOccupancy, 0) / occupancyTrend.length) : 0}%
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Home className="w-3.5 h-3.5" />周期总营收
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  ¥{occupancyTrend.reduce((a, b) => a + b.totalRevenue, 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="text-xs text-purple-600 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />平均ADR
                </div>
                <div className="text-2xl font-bold text-purple-700 mt-1">
                  ¥{occupancyTrend.length > 0 ? Math.round(occupancyTrend.reduce((a, b) => a + b.avgAdr, 0) / occupancyTrend.length) : 0}
                </div>
              </div>
            </div>

            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />近14天入住率趋势
            </h4>
            
            {occupancyTrend.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">暂无历史数据分析</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {occupancyTrend.map((day, i) => {
                  const maxRev = Math.max(...occupancyTrend.map(d => d.totalRevenue), 1);
                  const width = (day.totalRevenue / maxRev) * 100;
                  const occColor = day.avgOccupancy >= 85 ? 'bg-emerald-500' : day.avgOccupancy >= 60 ? 'bg-blue-500' : day.avgOccupancy >= 40 ? 'bg-amber-500' : 'bg-rose-400';
                  return (
                    <div key={day.date} className="flex items-center gap-2">
                      <div className="w-24 text-xs text-gray-500 flex-shrink-0">{day.date.slice(5)}</div>
                      <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${occColor} opacity-80 transition-all`}
                          style={{ width: `${day.avgOccupancy}%` }}
                        />
                        <div
                          className="absolute h-6 border-r-2 border-indigo-500 top-0"
                          style={{ left: `${width}%` }}
                          title={`营收 ¥${day.totalRevenue}`}
                        />
                      </div>
                      <div className="w-14 text-right text-xs font-medium text-gray-700 flex-shrink-0">
                        {day.avgOccupancy}%
                      </div>
                      <div className="w-20 text-right text-xs text-emerald-600 flex-shrink-0">
                        ¥{day.avgAdr}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 text-[11px] text-gray-500 pt-2 mt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" />入住率 ≥85%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded" />入住率 60-85%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded" />入住率 40-60%</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-2 border-r-2 border-indigo-500" />营收峰值</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-500" />各渠道库存池配置概览
            </h4>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {channelSummary.map(c => (
                <div key={c.channel} className="border border-gray-200 rounded-lg p-3 hover:border-indigo-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-gray-900">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.enabledRooms > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.enabledRooms}/{c.totalRooms} 启用
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-500">平均佣金</div>
                      <div className="font-semibold text-gray-800 mt-0.5">{c.avgCommission}</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-gray-500">价格区间</div>
                      <div className="font-semibold text-gray-800 mt-0.5">¥{c.avgMinPrice} ~ ¥{c.avgMaxPrice}</div>
                    </div>
                  </div>
                </div>
              ))}
              {channelSummary.length === 0 && (
                <div className="col-span-2 text-center py-8 text-gray-500 text-sm">
                  暂无渠道配置，请先初始化渠道库存池
                </div>
              )}
            </div>

            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2 pt-2 border-t border-gray-100">
              <Wrench className="w-4 h-4 text-purple-500" />按房间渠道详细配置
            </h4>
            
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-gray-600 font-medium">房间</th>
                    <th className="text-left p-2 text-gray-600 font-medium">渠道</th>
                    <th className="text-center p-2 text-gray-600 font-medium">启用</th>
                    <th className="text-center p-2 text-gray-600 font-medium">总库存</th>
                    <th className="text-center p-2 text-gray-600 font-medium">预留</th>
                    <th className="text-right p-2 text-gray-600 font-medium">最低/最高价</th>
                    <th className="text-right p-2 text-gray-600 font-medium">佣金率</th>
                  </tr>
                </thead>
                <tbody>
                  {channelConfigs.map((c: ChannelConfig, i) => (
                    <tr key={c.id} className={i % 2 ? 'bg-gray-50/50' : ''}>
                      <td className="p-2 text-gray-900 font-medium">{rooms.find(r => r.id === c.roomId)?.name || '-'}</td>
                      <td className="p-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          c.channel === 'direct' ? 'bg-green-100 text-green-700' :
                          c.channel === 'ota' ? 'bg-blue-100 text-blue-700' :
                          c.channel === 'corporate_longstay' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {channelSummary.find(x => x.channel === c.channel)?.name || c.channel}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {c.enabled ? (
                          <span className="text-emerald-600 font-medium">✓</span>
                        ) : (
                          <span className="text-gray-400">✗</span>
                        )}
                      </td>
                      <td className="p-2 text-center font-medium">{c.totalInventory}</td>
                      <td className="p-2 text-center text-amber-600">{c.reservedInventory}</td>
                      <td className="p-2 text-right text-gray-700">¥{c.minPrice} / ¥{c.maxPrice}</td>
                      <td className="p-2 text-right text-gray-700">{Math.round(c.commissionRate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="p-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">批量调价保护机制已启用</div>
                <div className="mt-0.5 text-amber-700">已支付、已锁价、已入住的订单不会被覆盖，系统会自动跳过并生成保护报告。调价范围限制：-80% ~ +300%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">适用房间</label>
                <select
                  className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                  value={filterRoomId}
                  onChange={e => setFilterRoomId(e.target.value)}
                >
                  <option value="all">全部房间 ({rooms.length})</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (¥{r.basePrice})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">调价方式</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setBatchAdjust(a => ({ ...a, type: 'percent' }))}
                    className={`flex-1 text-sm py-2 rounded border transition-colors ${
                      batchAdjust.type === 'percent'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    按百分比
                  </button>
                  <button
                    onClick={() => setBatchAdjust(a => ({ ...a, type: 'absolute' }))}
                    className={`flex-1 text-sm py-2 rounded border transition-colors ${
                      batchAdjust.type === 'absolute'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    按固定值
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                  value={batchStart}
                  onChange={e => setBatchStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">结束日期</label>
                <input
                  type="date"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                  value={batchEnd}
                  onChange={e => setBatchEnd(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  调整幅度 
                  {batchAdjust.type === 'percent' ? ' (%)' : ' (元)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="flex-1 text-sm border border-gray-300 rounded px-3 py-2"
                    value={batchAdjust.value}
                    onChange={e => setBatchAdjust(a => ({ ...a, value: Number(e.target.value) }))}
                    step={batchAdjust.type === 'percent' ? 5 : 10}
                  />
                  <div className="flex gap-1">
                    {[-30, -15, 0, 15, 30, 50].map(v => (
                      <button
                        key={v}
                        onClick={() => setBatchAdjust(a => ({ ...a, value: v }))}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        {v > 0 ? '+' : ''}{v}{batchAdjust.type === 'percent' ? '%' : '元'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleBatchUpdate}
              disabled={currentRole === 'guest'}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />执行批量调价（含已生效订单保护）
            </button>

            {batchResult && (
              <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  执行结果报告
                </h5>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-[10px] text-gray-500">涉及总日期</div>
                    <div className="text-lg font-bold text-gray-800">{batchResult.totalAffectedDates}</div>
                  </div>
                  <div className="bg-amber-50 rounded p-2 text-center">
                    <div className="text-[10px] text-amber-600">已保护跳过</div>
                    <div className="text-lg font-bold text-amber-700">{batchResult.protectedDates}</div>
                  </div>
                  <div className="bg-emerald-50 rounded p-2 text-center">
                    <div className="text-[10px] text-emerald-600">实际更新</div>
                    <div className="text-lg font-bold text-emerald-700">{batchResult.updatedDates}</div>
                  </div>
                </div>
                {batchResult.skippedOrders?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1.5">保护的订单列表：</div>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {batchResult.skippedOrders.slice(0, 5).map((o: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                          <span className="text-gray-700">订单 {o.orderNo}</span>
                          <span className="text-rose-600 font-medium">
                            锁价 ¥{o.lockedPrice} / 拟调 ¥{o.wouldBePrice} (差 ¥{o.diff})
                          </span>
                        </div>
                      ))}
                      {batchResult.skippedOrders.length > 5 && (
                        <div className="text-xs text-gray-400 text-center">... 共 {batchResult.skippedOrders.length} 个被保护</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
