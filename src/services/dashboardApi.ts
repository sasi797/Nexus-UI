import { api } from './api';

export interface DashboardStats {
  total_bookings: number; pending: number; in_progress: number; completed: number;
  ignored: number; da_numbers_count: number; at_risk: number;
}

export interface DashboardStatsParams {
  date?: string;
  tz?: string;
}

export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query<DashboardStats, DashboardStatsParams | void>({
      query: (params) => {
        if (!params || !params.date) return '/dashboard/stats';
        const p = new URLSearchParams({ date: params.date, tz: params.tz ?? 'UTC' });
        return `/dashboard/stats?${p}`;
      },
      providesTags: ['Dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardStatsQuery } = dashboardApi;
