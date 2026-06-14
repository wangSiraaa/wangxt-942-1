import type {
  ExceptionType,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionQueueItem,
  ChannelType,
  Order,
  MaintenanceRecord,
  CleaningSchedule,
  RefundRecord,
  ChannelInventorySnapshot,
  AuditActionCategory,
  DetailedAuditLog,
  UserRole,
} from '../types';

const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const EXCEPTION_TYPE_METADATA: Record<
  ExceptionType,
  {
    defaultSeverity: ExceptionSeverity;
    titleTemplate: string;
    descriptionTemplate: string;
    category: AuditActionCategory;
  }
> = {
  channel_oversell: {
    defaultSeverity: 'critical',
    titleTemplate: '渠道超卖预警',
    descriptionTemplate: '{channel}渠道存在超卖风险，涉及房间{roomId}，日期{date}',
    category: 'channel',
  },
  maintenance_extended: {
    defaultSeverity: 'warning',
    titleTemplate: '维修时间延长',
    descriptionTemplate: '维修工单{maintenanceId}预计延长完成，影响房间{roomId}',
    category: 'maintenance',
  },
  cleaning_incomplete: {
    defaultSeverity: 'warning',
    titleTemplate: '清洁任务未完成',
    descriptionTemplate: '房间{roomId}清洁任务{taskId}未按时完成，可能影响入住',
    category: 'inventory',
  },
  refund_failed: {
    defaultSeverity: 'critical',
    titleTemplate: '退款处理失败',
    descriptionTemplate: '订单{orderNo}退款失败，金额¥{amount}，原因：{reason}',
    category: 'order',
  },
  price_conflict: {
    defaultSeverity: 'warning',
    titleTemplate: '价格规则冲突',
    descriptionTemplate: '房间{roomId}日期{date}存在多组价格定义冲突',
    category: 'pricing',
  },
  inventory_conflict: {
    defaultSeverity: 'critical',
    titleTemplate: '库存分配冲突',
    descriptionTemplate: '房间{roomId}多渠道库存总和超过可用库存',
    category: 'inventory',
  },
};

interface CreateExceptionParams {
  type: ExceptionType;
  roomId?: string;
  orderId?: string;
  channel?: ChannelType;
  date?: string;
  metadata?: Record<string, any>;
  severity?: ExceptionSeverity;
  assigneeId?: string;
  operatorId: string;
  operatorRole: UserRole;
}

export const createException = (
  params: CreateExceptionParams
): ExceptionQueueItem => {
  const metadata = EXCEPTION_TYPE_METADATA[params.type];
  const now = Date.now();

  let title = metadata.titleTemplate;
  let description = metadata.descriptionTemplate;

  const templateVars: Record<string, string> = {
    roomId: params.roomId || '-',
    orderId: params.orderId || '-',
    orderNo: params.metadata?.orderNo || '-',
    channel: params.channel || '-',
    date: params.date || '-',
    maintenanceId: params.metadata?.maintenanceId || '-',
    taskId: params.metadata?.taskId || '-',
    amount: params.metadata?.amount?.toFixed?.(2) || String(params.metadata?.amount || '0'),
    reason: params.metadata?.reason || '未知',
  };

  for (const [key, value] of Object.entries(templateVars)) {
    title = title.replace(`{${key}}`, value);
    description = description.replace(`{${key}}`, value);
  }

  const auditTrailEntry = {
    timestamp: now,
    operatorId: params.operatorId,
    action: 'CREATED',
    note: `由${params.operatorRole}触发异常创建`,
  };

  return {
    id: generateId('ex'),
    type: params.type,
    severity: params.severity || metadata.defaultSeverity,
    status: 'pending',
    title,
    description,
    roomId: params.roomId,
    orderId: params.orderId,
    channel: params.channel,
    date: params.date,
    metadata: params.metadata || {},
    assigneeId: params.assigneeId,
    createdAt: now,
    updatedAt: now,
    auditTrail: [auditTrailEntry],
  };
};

export const updateExceptionStatus = (
  exception: ExceptionQueueItem,
  newStatus: ExceptionStatus,
  operatorId: string,
  operatorRole: UserRole,
  resolution?: string
): ExceptionQueueItem => {
  const now = Date.now();
  const statusActions: Record<ExceptionStatus, string> = {
    pending: 'REOPENED',
    processing: 'STARTED_PROCESSING',
    resolved: 'RESOLVED',
    ignored: 'IGNORED',
  };

  const updated: ExceptionQueueItem = {
    ...exception,
    status: newStatus,
    updatedAt: now,
    auditTrail: [
      ...exception.auditTrail,
      {
        timestamp: now,
        operatorId,
        action: statusActions[newStatus],
        note: resolution
          ? `${operatorRole}处理：${resolution}`
          : `${operatorRole}变更状态为${newStatus}`,
      },
    ],
  };

  if (newStatus === 'resolved') {
    updated.resolvedAt = now;
    updated.resolvedBy = operatorId;
    updated.resolution = resolution;
  }

  return updated;
};

export const assignException = (
  exception: ExceptionQueueItem,
  assigneeId: string,
  operatorId: string,
  operatorRole: UserRole
): ExceptionQueueItem => {
  const now = Date.now();
  return {
    ...exception,
    assigneeId,
    updatedAt: now,
    auditTrail: [
      ...exception.auditTrail,
      {
        timestamp: now,
        operatorId,
        action: 'ASSIGNED',
        note: `${operatorRole}分配给用户${assigneeId}`,
      },
    ],
  };
};

export const detectChannelOversell = (
  snapshots: ChannelInventorySnapshot[],
  operatorId: string,
  operatorRole: UserRole
): ExceptionQueueItem[] => {
  const exceptions: ExceptionQueueItem[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.oversoldUnits > 0) {
      exceptions.push(
        createException({
          type: 'channel_oversell',
          roomId: snapshot.roomId,
          channel: snapshot.channel,
          date: snapshot.date,
          severity: snapshot.oversoldUnits >= 2 ? 'critical' : 'warning',
          metadata: {
            oversoldUnits: snapshot.oversoldUnits,
            soldUnits: snapshot.soldUnits,
            totalUnits: snapshot.totalUnits,
          },
          operatorId,
          operatorRole,
        })
      );
    }
  }

  return exceptions;
};

export const detectMaintenanceExtended = (
  maintenances: MaintenanceRecord[],
  todayDate: string,
  operatorId: string,
  operatorRole: UserRole
): ExceptionQueueItem[] => {
  const exceptions: ExceptionQueueItem[] = [];

  for (const m of maintenances) {
    if (m.endDate < todayDate && !m.reason.includes('已完成')) {
      exceptions.push(
        createException({
          type: 'maintenance_extended',
          roomId: m.roomId,
          date: m.endDate,
          severity: 'warning',
          metadata: {
            maintenanceId: m.id,
            originalEndDate: m.endDate,
            reason: m.reason,
            operatorId: m.operatorId,
          },
          operatorId,
          operatorRole,
        })
      );
    }
  }

  return exceptions;
};

export const detectCleaningIncomplete = (
  schedules: CleaningSchedule[],
  todayDate: string,
  operatorId: string,
  operatorRole: UserRole
): ExceptionQueueItem[] => {
  const exceptions: ExceptionQueueItem[] = [];

  for (const schedule of schedules) {
    const isOverdue =
      schedule.date <= todayDate &&
      ['pending', 'failed'].includes(schedule.status);

    if (isOverdue) {
      exceptions.push(
        createException({
          type: 'cleaning_incomplete',
          roomId: schedule.roomId,
          date: schedule.date,
          severity: schedule.status === 'failed' ? 'warning' : 'info',
          metadata: {
            taskId: schedule.id,
            status: schedule.status,
            scheduledTime: schedule.scheduledTime,
            assigneeId: schedule.assigneeId,
            notes: schedule.notes,
          },
          operatorId,
          operatorRole,
        })
      );
    }
  }

  return exceptions;
};

export const detectRefundFailed = (
  refunds: RefundRecord[],
  orders: Order[],
  operatorId: string,
  operatorRole: UserRole
): ExceptionQueueItem[] => {
  const exceptions: ExceptionQueueItem[] = [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  for (const refund of refunds) {
    if (refund.amount > 0 && refund.refundAmount <= 0) {
      const order = orderMap.get(refund.orderId);
      exceptions.push(
        createException({
          type: 'refund_failed',
          orderId: refund.orderId,
          roomId: order?.roomId,
          date: new Date(refund.createdAt).toISOString().split('T')[0],
          severity: 'critical',
          metadata: {
            refundId: refund.id,
            orderNo: order?.orderNo || '-',
            amount: refund.amount,
            expectedRefund: refund.refundAmount,
            reason: '退款计算异常或金额为0',
            cancelFee: refund.cancelFee,
            benefitDeduction: refund.benefitDeduction,
          },
          operatorId,
          operatorRole,
        })
      );
    }
  }

  return exceptions;
};

export const runAllExceptionDetectors = (params: {
  snapshots: ChannelInventorySnapshot[];
  maintenances: MaintenanceRecord[];
  cleaningSchedules: CleaningSchedule[];
  refunds: RefundRecord[];
  orders: Order[];
  today: string;
  operatorId: string;
  operatorRole: UserRole;
}): ExceptionQueueItem[] => {
  const results: ExceptionQueueItem[] = [];

  results.push(...detectChannelOversell(params.snapshots, params.operatorId, params.operatorRole));
  results.push(...detectMaintenanceExtended(params.maintenances, params.today, params.operatorId, params.operatorRole));
  results.push(...detectCleaningIncomplete(params.cleaningSchedules, params.today, params.operatorId, params.operatorRole));
  results.push(...detectRefundFailed(params.refunds, params.orders, params.operatorId, params.operatorRole));

  return results;
};

export const createDetailedAuditLog = (params: {
  entityType: string;
  entityId: string;
  action: string;
  category: AuditActionCategory;
  oldValue: any;
  newValue: any;
  operatorId: string;
  operatorRole: UserRole;
  channel?: ChannelType;
  roomId?: string;
  orderId?: string;
  beforeState?: any;
  afterState?: any;
  changeSummary: string;
  relatedEntityIds?: string[];
}): DetailedAuditLog => {
  return {
    id: generateId('audit'),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    category: params.category,
    oldValue: params.oldValue,
    newValue: params.newValue,
    operatorId: params.operatorId,
    operatorRole: params.operatorRole,
    channel: params.channel,
    roomId: params.roomId,
    orderId: params.orderId,
    beforeState: params.beforeState,
    afterState: params.afterState,
    changeSummary: params.changeSummary,
    relatedEntityIds: params.relatedEntityIds,
    createdAt: Date.now(),
  };
};

export const filterExceptions = (
  exceptions: ExceptionQueueItem[],
  filters: {
    types?: ExceptionType[];
    severities?: ExceptionSeverity[];
    statuses?: ExceptionStatus[];
    roomId?: string;
    orderId?: string;
    assigneeId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): ExceptionQueueItem[] => {
  return exceptions.filter((e) => {
    if (filters.types && !filters.types.includes(e.type)) return false;
    if (filters.severities && !filters.severities.includes(e.severity)) return false;
    if (filters.statuses && !filters.statuses.includes(e.status)) return false;
    if (filters.roomId && e.roomId !== filters.roomId) return false;
    if (filters.orderId && e.orderId !== filters.orderId) return false;
    if (filters.assigneeId && e.assigneeId !== filters.assigneeId) return false;
    if (filters.dateFrom && e.date && e.date < filters.dateFrom) return false;
    if (filters.dateTo && e.date && e.date > filters.dateTo) return false;
    return true;
  });
};

export const getExceptionStats = (exceptions: ExceptionQueueItem[]): Record<string, number> => {
  const stats: Record<string, number> = {
    total: exceptions.length,
    pending: 0,
    processing: 0,
    resolved: 0,
    ignored: 0,
    critical: 0,
    warning: 0,
    info: 0,
  };

  for (const e of exceptions) {
    stats[e.status] = (stats[e.status] || 0) + 1;
    stats[e.severity] = (stats[e.severity] || 0) + 1;
    stats[e.type] = (stats[e.type] || 0) + 1;
  }

  return stats;
};
