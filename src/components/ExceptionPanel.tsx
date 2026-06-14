import { useState, useMemo } from 'react';
import { useBookingStore } from '../store/bookingStore';
import type { ExceptionQueueItem, ExceptionType, ExceptionSeverity, ExceptionStatus, ChannelType, DetailedAuditLog } from '../types';
import {
  AlertOctagon, AlertTriangle, Info, CheckCircle, Clock, User,
  RefreshCw, Filter, ChevronDown, ChevronRight, XCircle, FileText,
  Wrench, Sparkles, DollarSign, Users, Calendar as CalendarIcon,
  Search, Eye, Edit2, History, GitBranch, Zap
} from 'lucide-react';

const exceptionTypeConfig: Record<ExceptionType, { label: string; color: string; bg: string; icon: any; desc: string }> = {
  channel_oversell: { label: '渠道超卖', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', icon: Users, desc: '多渠道销售导致库存超额分配' },
  maintenance_extended: { label: '维修延长', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: Wrench, desc: '维修结束时间超过预估，影响后续订单' },
  cleaning_incomplete: { label: '清洁未完成', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Sparkles, desc: '客房清洁未按时完成，影响入住' },
  refund_failed: { label: '退款失败', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: DollarSign, desc: '退款交易失败，需要人工介入' },
  price_conflict: { label: '价格冲突', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Zap, desc: '不同渠道价格不一致超过阈值' },
  inventory_conflict: { label: '库存冲突', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', icon: GitBranch, desc: '库存分配出现矛盾需要调整' },
};

const severityConfig: Record<ExceptionSeverity, { label: string; color: string; dot: string; badge: string }> = {
  critical: { label: '严重', color: 'text-rose-700', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' },
  warning: { label: '警告', color: 'text-amber-700', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  info: { label: '提示', color: 'text-blue-700', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
};

const statusConfig: Record<ExceptionStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: 'text-rose-700', bg: 'bg-rose-50' },
  processing: { label: '处理中', color: 'text-blue-700', bg: 'bg-blue-50' },
  resolved: { label: '已解决', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ignored: { label: '已忽略', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const channelNames: Record<ChannelType, string> = {
  direct: '直销', ota: 'OTA平台', corporate_longstay: '企业长租', event_buyout: '临时包栋',
};

export default function ExceptionPanel() {
  const {
    exceptionQueue, updateException, assignExceptionTo, runExceptionDetection,
    rooms, orders, currentRole, currentUserId, detailedAuditLogs,
    getDetailedAuditLogs,
  } = useBookingStore();

  const [activeTab, setActiveTab] = useState<'list' | 'audit'>('list');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [assigneeSelect, setAssigneeSelect] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const s = { total: exceptionQueue.length, pending: 0, processing: 0, resolved: 0, ignored: 0, critical: 0, warning: 0, info: 0 };
    exceptionQueue.forEach(e => {
      if (e.status === 'pending') s.pending++;
      else if (e.status === 'processing') s.processing++;
      else if (e.status === 'resolved') s.resolved++;
      else s.ignored++;
      if (e.severity === 'critical') s.critical++;
      else if (e.severity === 'warning') s.warning++;
      else s.info++;
    });
    return s;
  }, [exceptionQueue]);

  const filtered = useMemo(() => {
    return exceptionQueue.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (searchText) {
        const search = searchText.toLowerCase();
        const match = e.title.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search) ||
          (e.orderId && orders.find(o => o.id === e.orderId)?.orderNo.toLowerCase().includes(search)) ||
          (e.roomId && rooms.find(r => r.id === e.roomId)?.name.toLowerCase().includes(search));
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, info: 2 };
      const statusOrder = { pending: 0, processing: 1, resolved: 3, ignored: 4 };
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
      if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
      return b.createdAt - a.createdAt;
    });
  }, [exceptionQueue, filterType, filterSeverity, filterStatus, searchText, orders, rooms]);

  const relatedAuditLogs = useMemo(() => {
    return getDetailedAuditLogs(50).filter(log => 
      log.category === 'exception' || log.category === 'order' || log.category === 'inventory'
    );
  }, [getDetailedAuditLogs]);

  const handleDetect = () => {
    setIsDetecting(true);
    try { runExceptionDetection(); } finally {
      setTimeout(() => setIsDetecting(false), 500);
    }
  };

  const handleStatusChange = (ex: ExceptionQueueItem, newStatus: ExceptionStatus, note?: string) => {
    updateException(ex.id, newStatus, currentUserId, currentRole, note || resolveNote);
    setResolveNote('');
  };

  const handleAssign = (exId: string, assigneeId: string) => {
    assignExceptionTo(exId, assigneeId, currentUserId, currentRole, '手动分配处理人');
    setAssigneeSelect(prev => ({ ...prev, [exId]: '' }));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-semibold text-gray-900">异常队列中心</h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-gray-600">严重: <b className="text-rose-600">{stats.critical}</b></span>
            </div>
            <div className="h-3 w-px bg-gray-300" />
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-gray-600">警告: <b className="text-amber-600">{stats.warning}</b></span>
            </div>
            <div className="h-3 w-px bg-gray-300" />
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-gray-600">待处理: <b className="text-blue-600">{stats.pending}</b></span>
            </div>
            <button
              onClick={handleDetect}
              disabled={isDetecting || currentRole === 'guest'}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 rounded hover:bg-rose-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
              {isDetecting ? '检测中' : '重新检测'}
            </button>
          </div>
        </div>
        <div className="flex">
          {[
            { id: 'list', label: '异常列表', icon: AlertOctagon, badge: stats.pending > 0 ? stats.pending : null },
            { id: 'audit', label: '审计追踪', icon: History, badge: null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-rose-600 border-b-2 border-rose-600 bg-rose-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge !== null && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[420px] overflow-y-auto">
        {activeTab === 'list' && (
          <div className="p-4">
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-rose-50 rounded-lg p-3">
                <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
                  <div className="w-2 h-2 bg-rose-500 rounded-full" />待处理
                </div>
                <div className="text-2xl font-bold text-rose-700 mt-0.5">{stats.pending}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />处理中
                </div>
                <div className="text-2xl font-bold text-blue-700 mt-0.5">{stats.processing}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />已解决
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-0.5">{stats.resolved}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 font-medium">异常总数</div>
                <div className="text-2xl font-bold text-gray-700 mt-0.5">{stats.total}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索异常标题/订单号/房间..."
                  className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-1.5"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
              </div>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="all">全部类型</option>
                {Object.entries(exceptionTypeConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
              >
                <option value="all">全部严重度</option>
                {Object.entries(severityConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">全部状态</option>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-sm">没有匹配的异常项</p>
                <p className="text-xs text-gray-400 mt-1">点击"重新检测"可扫描新的异常</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(ex => {
                  const typeCfg = exceptionTypeConfig[ex.type];
                  const sevCfg = severityConfig[ex.severity];
                  const statusCfg = statusConfig[ex.status];
                  const room = rooms.find(r => r.id === ex.roomId);
                  const order = orders.find(o => o.id === ex.orderId);
                  const Icon = typeCfg.icon;
                  const expanded = expandedId === ex.id;
                  return (
                    <div key={ex.id} className={`border rounded-lg overflow-hidden transition-all ${typeCfg.bg}`}>
                      <div
                        className="p-3 cursor-pointer hover:bg-white/60 transition-colors"
                        onClick={() => setExpandedId(expanded ? null : ex.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded bg-white ${sevCfg.color} flex-shrink-0`}>
                            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                          <div className={`p-2 rounded-lg bg-white ${typeCfg.color} flex-shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${sevCfg.badge} font-medium`}>
                                <span className={`inline-block w-1.5 h-1.5 ${sevCfg.dot} rounded-full mr-1 align-middle`} />
                                {sevCfg.label}
                              </span>
                              <span className="font-medium text-sm text-gray-900">{typeCfg.label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                              {ex.channel && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
                                  {channelNames[ex.channel] || ex.channel}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-800 mt-1 font-medium">{ex.title}</div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                              {room && (
                                <span className="flex items-center gap-0.5">
                                  <Eye className="w-3 h-3" />{room.name}
                                </span>
                              )}
                              {order && (
                                <span className="flex items-center gap-0.5">
                                  <FileText className="w-3 h-3" />{order.orderNo}
                                </span>
                              )}
                              {ex.date && (
                                <span className="flex items-center gap-0.5">
                                  <CalendarIcon className="w-3 h-3" />{ex.date}
                                </span>
                              )}
                              <span>{formatDate(ex.createdAt)}</span>
                              {ex.assigneeId && (
                                <span className="flex items-center gap-0.5 text-indigo-600">
                                  <User className="w-3 h-3" />处理人: {ex.assigneeId}
                                </span>
                              )}
                              {ex.resolvedAt && (
                                <span className="text-emerald-600">{formatDate(ex.resolvedAt)} 解决</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-gray-200/50 bg-white p-4 space-y-3">
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1">异常描述</div>
                            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                              {ex.description}
                              <div className="text-xs text-gray-400 mt-1.5">{typeCfg.desc}</div>
                            </div>
                          </div>

                          {Object.keys(ex.metadata).length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1">详细数据</div>
                              <div className="bg-gray-50 rounded-lg p-2 text-xs font-mono text-gray-600 overflow-x-auto max-h-24 overflow-y-auto">
                                {JSON.stringify(ex.metadata, null, 2)}
                              </div>
                            </div>
                          )}

                          {ex.auditTrail.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                                <History className="w-3.5 h-3.5" />处理追踪 ({ex.auditTrail.length})
                              </div>
                              <div className="space-y-1.5">
                                {ex.auditTrail.slice().reverse().map((a, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                                    <div className="flex-1 bg-gray-50 rounded p-2">
                                      <div className="flex items-center gap-2 text-gray-700">
                                        <span className="font-medium">{a.operatorId}</span>
                                        <span className="text-gray-400">→</span>
                                        <span>{a.action}</span>
                                        <span className="text-gray-400 ml-auto">{formatDate(a.timestamp)}</span>
                                      </div>
                                      {a.note && <div className="text-gray-500 mt-0.5">{a.note}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {currentRole !== 'guest' && ex.status !== 'resolved' && ex.status !== 'ignored' && (
                            <div className="pt-3 border-t border-gray-100 space-y-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex-1 min-w-[200px]">
                                  <input
                                    type="text"
                                    placeholder="处理备注（可选）..."
                                    className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5"
                                    value={resolveNote}
                                    onChange={e => setResolveNote(e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {ex.status === 'pending' && (
                                    <button
                                      onClick={() => handleStatusChange(ex, 'processing', '开始处理')}
                                      className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                                    >
                                      <Edit2 className="w-3 h-3" />开始处理
                                    </button>
                                  )}
                                  {ex.status === 'processing' && (
                                    <>
                                      <button
                                        onClick={() => handleStatusChange(ex, 'resolved')}
                                        className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors flex items-center gap-1"
                                      >
                                        <CheckCircle className="w-3 h-3" />标记解决
                                      </button>
                                      <button
                                        onClick={() => handleStatusChange(ex, 'pending', '退回待处理')}
                                        className="px-3 py-1.5 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"
                                      >
                                        退回
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleStatusChange(ex, 'ignored', '确认无需处理')}
                                    className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
                                  >
                                    <XCircle className="w-3 h-3" />忽略
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-20">分配处理人:</span>
                                <select
                                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
                                  value={assigneeSelect[ex.id] || ''}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setAssigneeSelect(prev => ({ ...prev, [ex.id]: v }));
                                    if (v) handleAssign(ex.id, v);
                                  }}
                                >
                                  <option value="">-- 选择处理人 --</option>
                                  <option value="user_1">房东 (user_1)</option>
                                  <option value="user_3">运营 (user_3)</option>
                                  <option value="operator_li">李运营</option>
                                  <option value="operator_wang">王运营</option>
                                </select>
                              </div>
                            </div>
                          )}
                          {ex.resolution && (
                            <div className="bg-emerald-50 rounded-lg p-3 text-sm">
                              <div className="text-xs font-medium text-emerald-700 mb-1">解决方案</div>
                              <div className="text-emerald-800">{ex.resolution}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />详细审计日志（最近 {relatedAuditLogs.length} 条）
              </h4>
            </div>
            
            <div className="space-y-2">
              {relatedAuditLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">暂无审计记录</p>
                </div>
              ) : (
                relatedAuditLogs.map((log: DetailedAuditLog, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded flex-shrink-0 ${
                        log.category === 'exception' ? 'bg-rose-100 text-rose-600' :
                        log.category === 'order' ? 'bg-blue-100 text-blue-600' :
                        log.category === 'pricing' ? 'bg-emerald-100 text-emerald-600' :
                        log.category === 'inventory' ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {log.category === 'exception' ? <AlertOctagon className="w-3.5 h-3.5" /> :
                         log.category === 'order' ? <FileText className="w-3.5 h-3.5" /> :
                         log.category === 'pricing' ? <TrendingUpSvg /> :
                         log.category === 'inventory' ? <Users className="w-3.5 h-3.5" /> :
                         <Info className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            log.category === 'exception' ? 'bg-rose-50 text-rose-700' :
                            log.category === 'order' ? 'bg-blue-50 text-blue-700' :
                            log.category === 'pricing' ? 'bg-emerald-50 text-emerald-700' :
                            log.category === 'inventory' ? 'bg-purple-50 text-purple-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {log.category}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{log.action}</span>
                          {log.channel && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {channelNames[log.channel] || log.channel}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">{formatDate(log.createdAt)}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{log.changeSummary}</div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 flex-wrap">
                          <span>操作人: {log.operatorId} ({log.operatorRole})</span>
                          {log.roomId && <span>房间: {rooms.find(r => r.id === log.roomId)?.name || log.roomId}</span>}
                          {log.orderId && <span>订单: {orders.find(o => o.id === log.orderId)?.orderNo || log.orderId}</span>}
                          {log.entityId && <span>对象: {log.entityType}#{log.entityId.slice(-8)}</span>}
                        </div>
                        {(log.beforeState || log.afterState) && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {log.beforeState && (
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-[10px] text-gray-500 mb-0.5 font-medium">变更前</div>
                                <div className="text-[10px] font-mono text-gray-600 truncate">
                                  {JSON.stringify(log.beforeState).slice(0, 80)}...
                                </div>
                              </div>
                            )}
                            {log.afterState && (
                              <div className="bg-emerald-50 rounded p-2">
                                <div className="text-[10px] text-emerald-600 mb-0.5 font-medium">变更后</div>
                                <div className="text-[10px] font-mono text-emerald-700 truncate">
                                  {JSON.stringify(log.afterState).slice(0, 80)}...
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendingUpSvg() { return <DollarSign className="w-3.5 h-3.5" />; }
