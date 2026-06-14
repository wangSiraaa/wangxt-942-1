import type { 
  Room, PriceVersion, HolidayPrice, HistoricalOccupancyRecord, 
  MaintenanceRecord, CleaningSchedule, PricingSuggestion, PricingFactor,
  PricingSuggestionType
} from '../types';
import { isHoliday, isWeekend, getDatesBetween, getToday, addDays, getDaysDiff } from './dateUtils';
import { calculateDailyPrice } from './priceCalculator';

export interface PricingEngineConfig {
  holidayWeight: number;
  weekendWeight: number;
  maintenanceRiskWeight: number;
  cleaningCapacityWeight: number;
  historicalOccupancyWeight: number;
  demandForecastWeight: number;
  minAdjustmentPercent: number;
  maxAdjustmentPercent: number;
  confidenceThreshold: number;
}

export const DEFAULT_PRICING_CONFIG: PricingEngineConfig = {
  holidayWeight: 0.3,
  weekendWeight: 0.2,
  maintenanceRiskWeight: 0.15,
  cleaningCapacityWeight: 0.15,
  historicalOccupancyWeight: 0.2,
  demandForecastWeight: 0.1,
  minAdjustmentPercent: -30,
  maxAdjustmentPercent: 50,
  confidenceThreshold: 0.6,
};

export const calculateHolidayFactor = (date: string): PricingFactor => {
  const isHol = isHoliday(date);
  const isWeek = isWeekend(date);
  
  let value = 0;
  let description = '';
  
  if (isHol) {
    value = 0.5;
    description = '节假日，需求旺盛，建议涨价';
  } else if (isWeek) {
    value = 0.2;
    description = '周末，需求较高，建议适当涨价';
  } else {
    value = 0;
    description = '工作日，需求平稳';
  }
  
  return {
    factor: 'holiday',
    weight: DEFAULT_PRICING_CONFIG.holidayWeight,
    value,
    description,
  };
};

export const calculateWeekendFactor = (date: string): PricingFactor => {
  const isWeek = isWeekend(date);
  
  return {
    factor: 'weekend',
    weight: DEFAULT_PRICING_CONFIG.weekendWeight,
    value: isWeek ? 0.15 : 0,
    description: isWeek ? '周末溢价' : '工作日无溢价',
  };
};

export const calculateMaintenanceRiskFactor = (
  roomId: string,
  date: string,
  maintenances: MaintenanceRecord[]
): PricingFactor => {
  const upcomingMaintenance = maintenances.find(m => 
    m.roomId === roomId && 
    m.startDate >= date && 
    getDaysDiff(date, m.startDate) <= 7
  );
  
  let value = 0;
  let description = '无近期维修计划';
  
  if (upcomingMaintenance) {
    const daysUntil = getDaysDiff(date, upcomingMaintenance.startDate);
    if (daysUntil <= 2) {
      value = -0.3;
      description = `2天内有维修计划（${upcomingMaintenance.reason}），建议降价促销减少空置`;
    } else if (daysUntil <= 7) {
      value = -0.15;
      description = `7天内有维修计划（${upcomingMaintenance.reason}），建议适当降价`;
    }
  }
  
  return {
    factor: 'maintenance_risk',
    weight: DEFAULT_PRICING_CONFIG.maintenanceRiskWeight,
    value,
    description,
  };
};

export const calculateCleaningCapacityFactor = (
  roomId: string,
  date: string,
  cleaningSchedules: CleaningSchedule[]
): PricingFactor => {
  const dayCleanings = cleaningSchedules.filter(c => 
    c.roomId === roomId && 
    c.date === date && 
    c.status !== 'completed'
  );
  
  const pendingCleanings = dayCleanings.filter(c => c.status === 'pending').length;
  const inProgressCleanings = dayCleanings.filter(c => c.status === 'in_progress').length;
  const totalPending = pendingCleanings + inProgressCleanings;
  
  let value = 0;
  let description = '清洁人力充足';
  
  if (totalPending >= 3) {
    value = 0.2;
    description = `当日待清洁任务较多（${totalPending}个），建议涨价控制入住节奏`;
  } else if (totalPending >= 2) {
    value = 0.1;
    description = `当日有${totalPending}个待清洁任务，可适当涨价`;
  } else if (totalPending === 0) {
    value = -0.05;
    description = '清洁人力充足，可适当降价促销';
  }
  
  return {
    factor: 'cleaning_capacity',
    weight: DEFAULT_PRICING_CONFIG.cleaningCapacityWeight,
    value,
    description,
  };
};

export const calculateHistoricalOccupancyFactor = (
  roomId: string,
  date: string,
  historicalRecords: HistoricalOccupancyRecord[]
): PricingFactor => {
  const sameDayLastYear = addDays(date, -365);
  const sameDayLastMonth = addDays(date, -30);
  
  const historicalData = historicalRecords.filter(r => 
    r.roomId === roomId && 
    (r.date === sameDayLastYear || r.date === sameDayLastMonth)
  );
  
  let avgOccupancy = 0;
  let description = '无历史数据参考';
  
  if (historicalData.length > 0) {
    avgOccupancy = historicalData.reduce((sum, r) => sum + r.occupancyRate, 0) / historicalData.length;
    
    if (avgOccupancy >= 0.9) {
      value = 0.3;
      description = `历史同期入住率${(avgOccupancy * 100).toFixed(0)}%，需求旺盛，建议涨价`;
    } else if (avgOccupancy >= 0.7) {
      value = 0.15;
      description = `历史同期入住率${(avgOccupancy * 100).toFixed(0)}%，需求较好，可适当涨价`;
    } else if (avgOccupancy >= 0.5) {
      value = 0;
      description = `历史同期入住率${(avgOccupancy * 100).toFixed(0)}%，需求平稳`;
    } else if (avgOccupancy >= 0.3) {
      value = -0.1;
      description = `历史同期入住率${(avgOccupancy * 100).toFixed(0)}%，需求较低，建议适当降价`;
    } else {
      value = -0.25;
      description = `历史同期入住率${(avgOccupancy * 100).toFixed(0)}%，需求低迷，建议降价促销`;
    }
  }
  
  return {
    factor: 'historical_occupancy',
    weight: DEFAULT_PRICING_CONFIG.historicalOccupancyWeight,
    value,
    description,
  };
};

export const calculateDemandForecastFactor = (
  roomId: string,
  date: string,
  historicalRecords: HistoricalOccupancyRecord[]
): PricingFactor => {
  const next7Days = getDatesBetween(date, addDays(date, 7));
  const futureBookings = historicalRecords.filter(r => 
    r.roomId === roomId && 
    next7Days.includes(r.date)
  );
  
  let value = 0;
  let description = '无需求预测数据';
  
  if (futureBookings.length > 0) {
    const avgOccupancy = futureBookings.reduce((sum, r) => sum + r.occupancyRate, 0) / futureBookings.length;
    
    if (avgOccupancy >= 0.8) {
      value = 0.2;
      description = `未来7天预测入住率${(avgOccupancy * 100).toFixed(0)}%，需求旺盛`;
    } else if (avgOccupancy >= 0.6) {
      value = 0.1;
      description = `未来7天预测入住率${(avgOccupancy * 100).toFixed(0)}%，需求较好`;
    } else if (avgOccupancy < 0.3) {
      value = -0.15;
      description = `未来7天预测入住率${(avgOccupancy * 100).toFixed(0)}%，需求较低`;
    }
  }
  
  return {
    factor: 'demand_forecast',
    weight: DEFAULT_PRICING_CONFIG.demandForecastWeight,
    value,
    description,
  };
};

export const calculateAllFactors = (
  roomId: string,
  date: string,
  maintenances: MaintenanceRecord[],
  cleaningSchedules: CleaningSchedule[],
  historicalRecords: HistoricalOccupancyRecord[]
): PricingFactor[] => {
  return [
    calculateHolidayFactor(date),
    calculateWeekendFactor(date),
    calculateMaintenanceRiskFactor(roomId, date, maintenances),
    calculateCleaningCapacityFactor(roomId, date, cleaningSchedules),
    calculateHistoricalOccupancyFactor(roomId, date, historicalRecords),
    calculateDemandForecastFactor(roomId, date, historicalRecords),
  ];
};

export const calculateSuggestedAdjustment = (
  factors: PricingFactor[],
  config: PricingEngineConfig = DEFAULT_PRICING_CONFIG
): { adjustmentPercent: number; confidenceScore: number; suggestionType: PricingSuggestionType; rationale: string } => {
  let weightedSum = 0;
  let totalWeight = 0;
  let activeFactors = 0;
  
  for (const factor of factors) {
    if (factor.value !== 0) {
      activeFactors++;
    }
    weightedSum += factor.value * factor.weight;
    totalWeight += factor.weight;
  }
  
  const rawAdjustment = (weightedSum / totalWeight) * 100;
  
  let adjustmentPercent = Math.max(
    config.minAdjustmentPercent,
    Math.min(config.maxAdjustmentPercent, rawAdjustment)
  );
  
  const confidenceScore = Math.min(1, activeFactors / factors.length * 0.7 + 0.3);
  
  let suggestionType: PricingSuggestionType;
  if (adjustmentPercent >= 5) {
    suggestionType = 'raise';
  } else if (adjustmentPercent <= -5) {
    suggestionType = 'lower';
  } else if (adjustmentPercent <= -15) {
    suggestionType = 'restrict';
  } else {
    suggestionType = 'hold';
  }
  
  if (adjustmentPercent > 0 && adjustmentPercent < 5) {
    adjustmentPercent = 5;
  } else if (adjustmentPercent < 0 && adjustmentPercent > -5) {
    adjustmentPercent = 0;
    suggestionType = 'hold';
  }
  
  const rationaleParts = factors
    .filter(f => f.value !== 0)
    .map(f => f.description);
  
  const rationale = rationaleParts.length > 0 
    ? rationaleParts.join('；') 
    : '各因素平稳，建议维持当前价格';
  
  return {
    adjustmentPercent,
    confidenceScore,
    suggestionType,
    rationale,
  };
};

export const generatePricingSuggestion = (
  room: Room,
  date: string,
  priceVersions: PriceVersion[],
  holidayPrices: HolidayPrice[],
  maintenances: MaintenanceRecord[],
  cleaningSchedules: CleaningSchedule[],
  historicalRecords: HistoricalOccupancyRecord[],
  config: PricingEngineConfig = DEFAULT_PRICING_CONFIG
): PricingSuggestion => {
  const currentPriceResult = calculateDailyPrice(room, date, priceVersions, holidayPrices);
  const currentPrice = currentPriceResult.finalPrice;
  
  const factors = calculateAllFactors(room.id, date, maintenances, cleaningSchedules, historicalRecords);
  const { adjustmentPercent, confidenceScore, suggestionType, rationale } = calculateSuggestedAdjustment(factors, config);
  
  const suggestedPrice = Math.round(currentPrice * (1 + adjustmentPercent / 100) * 100) / 100;
  
  return {
    id: `suggest_${room.id}_${date}_${Date.now()}`,
    roomId: room.id,
    date,
    currentPrice,
    suggestedPrice,
    suggestionType,
    adjustmentPercent,
    confidenceScore,
    factors,
    rationale,
    createdAt: Date.now(),
    status: 'pending',
  };
};

export const generateBulkPricingSuggestions = (
  rooms: Room[],
  startDate: string,
  endDate: string,
  priceVersions: PriceVersion[],
  holidayPrices: HolidayPrice[],
  maintenances: MaintenanceRecord[],
  cleaningSchedules: CleaningSchedule[],
  historicalRecords: HistoricalOccupancyRecord[],
  config: PricingEngineConfig = DEFAULT_PRICING_CONFIG
): PricingSuggestion[] => {
  const suggestions: PricingSuggestion[] = [];
  const dates = getDatesBetween(startDate, endDate);
  
  for (const room of rooms) {
    for (const date of dates) {
      const suggestion = generatePricingSuggestion(
        room, date, priceVersions, holidayPrices,
        maintenances, cleaningSchedules, historicalRecords, config
      );
      
      if (suggestion.suggestionType !== 'hold' || suggestion.confidenceScore >= config.confidenceThreshold) {
        suggestions.push(suggestion);
      }
    }
  }
  
  return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
};

export const applyPricingSuggestion = (
  suggestion: PricingSuggestion,
  operatorId: string
): { holidayPrice: Omit<HolidayPrice, 'id' | 'createdAt'>; suggestion: PricingSuggestion } => {
  return {
    holidayPrice: {
      roomId: suggestion.roomId,
      date: suggestion.date,
      price: suggestion.suggestedPrice,
      reason: suggestion.rationale,
    },
    suggestion: {
      ...suggestion,
      status: 'applied',
      appliedAt: Date.now(),
      appliedBy: operatorId,
    },
  };
};

export const rejectPricingSuggestion = (
  suggestion: PricingSuggestion,
  operatorId: string
): PricingSuggestion => {
  return {
    ...suggestion,
    status: 'rejected',
    appliedAt: Date.now(),
    appliedBy: operatorId,
  };
};

export const generateHistoricalOccupancyData = (
  rooms: Room[],
  days: number = 90
): HistoricalOccupancyRecord[] => {
  const records: HistoricalOccupancyRecord[] = [];
  const today = getToday();
  const channels = ['direct', 'ota', 'corporate_longstay', 'event_buyout'] as const;
  
  for (const room of rooms) {
    for (let i = 1; i <= days; i++) {
      const date = addDays(today, -i);
      const baseOccupancy = 0.5 + Math.random() * 0.4;
      const isWeek = isWeekend(date);
      const isHol = isHoliday(date);
      
      let occupancyRate = baseOccupancy;
      if (isHol) occupancyRate *= 1.3;
      if (isWeek) occupancyRate *= 1.15;
      occupancyRate = Math.min(1, occupancyRate);
      
      const avgDailyRate = room.basePrice * (0.8 + Math.random() * 0.4);
      const revenue = avgDailyRate * occupancyRate;
      
      for (const channel of channels) {
        if (Math.random() > 0.3 || channel === 'direct') {
          records.push({
            date,
            roomId: room.id,
            occupancyRate: Math.round(occupancyRate * 100) / 100,
            avgDailyRate: Math.round(avgDailyRate * 100) / 100,
            revenue: Math.round(revenue * 100) / 100,
            channel,
          });
        }
      }
    }
  }
  
  return records;
};

export const generateCleaningSchedule = (
  rooms: Room[],
  startDate: string,
  endDate: string
): CleaningSchedule[] => {
  const schedules: CleaningSchedule[] = [];
  const dates = getDatesBetween(startDate, endDate);
  const statuses: CleaningSchedule['status'][] = ['pending', 'in_progress', 'completed', 'failed'];
  
  for (const room of rooms) {
    for (const date of dates) {
      if (Math.random() > 0.7) {
        const statusIndex = Math.floor(Math.random() * statuses.length);
        schedules.push({
          id: `clean_${room.id}_${date}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          roomId: room.id,
          date,
          scheduledTime: `${9 + Math.floor(Math.random() * 8)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          status: statuses[statusIndex],
          assigneeId: `cleaner_${Math.floor(Math.random() * 3) + 1}`,
          completedAt: statuses[statusIndex] === 'completed' ? Date.now() : undefined,
          notes: Math.random() > 0.8 ? '需要更换床单' : undefined,
        });
      }
    }
  }
  
  return schedules;
};
