import { api } from './api';

export interface AgentBrief { id: string; name: string; email: string }
export interface AttendanceRecord {
  id: string; agent_id: string; agent: AgentBrief | null;
  shift_id: string | null; date: string; status: string;
  check_in: string | null; check_out: string | null; updated_at: string;
}
export interface AttendanceSummary {
  date: string; present: number; absent: number; on_break: number; late: number; total: number;
}
export interface AttendanceUpsertItem {
  agent_id: string; shift_id?: string; date: string; status: string;
  check_in?: string; check_out?: string;
}
export interface AttendanceBulkUpdate {
  date: string; shift_id?: string; records: AttendanceUpsertItem[];
}

export const attendanceApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAttendance: build.query<AttendanceRecord[], { date: string; shift_id?: string }>({
      query: (params) => ({ url: '/attendance', params }),
      providesTags: ['Attendance'],
    }),
    upsertAttendance: build.mutation<AttendanceRecord[], AttendanceBulkUpdate>({
      query: (body) => ({ url: '/attendance', method: 'POST', body }),
      invalidatesTags: ['Attendance'],
    }),
    getAttendanceSummary: build.query<AttendanceSummary, { date: string }>({
      query: (params) => ({ url: '/attendance/summary', params }),
      providesTags: ['Attendance'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAttendanceQuery, useUpsertAttendanceMutation, useGetAttendanceSummaryQuery } = attendanceApi;
