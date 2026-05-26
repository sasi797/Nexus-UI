import { api } from './api';

export interface ReportStats {
  total_bookings: number; completed: number; pending: number;
  sla_breach: number; completion_rate: number;
  total_bookings_change: number; completed_change: number;
  pending_change: number; sla_breach_change: number;
}
export interface TrendPoint { date: string; received: number; completed: number }
export interface PrioritySlice { name: string; value: number; color: string }
export interface DailySummaryRow {
  date: string; received: number; completed: number; pending: number; rate: number;
}
export interface HourlyPoint { hour: number; label: string; received: number; completed: number; }
export interface AvgCompletionByPriority { priority: string; avg_hours: number; count: number; }
export interface AvgCompletionReport { overall_avg_hours: number; overall_count: number; by_priority: AvgCompletionByPriority[]; }
export interface StatusBreakdownRow { priority: string; pending: number; in_progress: number; completed: number; }

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getReportStats: build.query<ReportStats, void>({
      query: () => '/reports/stats',
      providesTags: ['Reports'],
    }),
    getTrend: build.query<TrendPoint[], { days?: number }>({
      query: (params) => ({ url: '/reports/trend', params }),
      providesTags: ['Reports'],
    }),
    getPriorityDistribution: build.query<PrioritySlice[], void>({
      query: () => '/reports/priority-distribution',
      providesTags: ['Reports'],
    }),
    getDailySummary: build.query<DailySummaryRow[], { days?: number }>({
      query: (params) => ({ url: '/reports/daily-summary', params }),
      providesTags: ['Reports'],
    }),
    getHourlyActivity: build.query<HourlyPoint[], { days?: number; tz?: string; date?: string }>({
      query: (params) => ({ url: '/reports/hourly', params }),
      providesTags: ['Reports'],
    }),
    getAvgCompletion: build.query<AvgCompletionReport, void>({
      query: () => '/reports/avg-completion',
      providesTags: ['Reports'],
    }),
    getStatusBreakdown: build.query<StatusBreakdownRow[], void>({
      query: () => '/reports/status-breakdown',
      providesTags: ['Reports'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetReportStatsQuery, useGetTrendQuery, useGetPriorityDistributionQuery,
  useGetDailySummaryQuery, useGetHourlyActivityQuery, useGetAvgCompletionQuery,
  useGetStatusBreakdownQuery,
} = reportsApi;
