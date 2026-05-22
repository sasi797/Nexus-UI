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
  }),
  overrideExisting: false,
});

export const { useGetReportStatsQuery, useGetTrendQuery, useGetPriorityDistributionQuery, useGetDailySummaryQuery } = reportsApi;
