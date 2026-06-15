import { api } from './api';

export interface DashboardStats {
  total_bookings: number; pending: number; in_progress: number; completed: number;
  da_numbers_count: number;
}

export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query<DashboardStats, void>({
      query: () => '/dashboard/stats',
      providesTags: ['Dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardStatsQuery } = dashboardApi;
