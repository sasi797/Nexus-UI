import { api } from './api';

export interface AgentBrief { id: string; name: string; email: string }
export interface AllocationLogEntry {
  id: string; booking_id: string; agent_id: string; agent: AgentBrief | null;
  pointer_value: number; pool_size: number; allocated_at: string;
}

export const allocationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllocationLog: build.query<AllocationLogEntry[], { booking_id?: string; skip?: number; limit?: number }>({
      query: (params) => ({ url: '/allocations/log', params }),
      providesTags: ['AllocationLog'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAllocationLogQuery } = allocationsApi;
