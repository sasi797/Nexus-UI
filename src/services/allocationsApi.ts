import { api } from './api';

export interface AllocationStatus {
  pointer: number; pool_size: number;
  next_agent_id: string | null; next_agent_name: string | null;
}
export interface AgentBrief { id: string; name: string; email: string }
export interface AllocationLogEntry {
  id: string; booking_id: string; agent_id: string; agent: AgentBrief | null;
  pointer_value: number; pool_size: number; allocated_at: string;
}

export const allocationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllocationStatus: build.query<AllocationStatus, void>({
      query: () => '/allocations/status',
      providesTags: ['AllocationLog'],
    }),
    runAllocation: build.mutation<AllocationLogEntry, { booking_id: string }>({
      query: (body) => ({ url: '/allocations/run', method: 'POST', body }),
      invalidatesTags: ['AllocationLog', 'PendingQueue', 'Booking', 'Dashboard'],
    }),
    getAllocationLog: build.query<AllocationLogEntry[], { booking_id?: string; skip?: number; limit?: number }>({
      query: (params) => ({ url: '/allocations/log', params }),
      providesTags: ['AllocationLog'],
    }),
    runAllPending: build.mutation<{ allocated: number; message: string }, void>({
      query: () => ({ url: '/allocations/run-all-pending', method: 'POST' }),
      invalidatesTags: ['AllocationLog', 'PendingQueue', 'Booking', 'Dashboard'],
    }),
    resetPointer: build.mutation<void, void>({
      query: () => ({ url: '/allocations/reset-pointer', method: 'POST' }),
      invalidatesTags: ['AllocationLog'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAllocationStatusQuery, useRunAllocationMutation, useRunAllPendingMutation, useGetAllocationLogQuery, useResetPointerMutation } = allocationsApi;
