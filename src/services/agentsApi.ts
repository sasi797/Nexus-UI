import { api } from './api';

export interface ShiftInfo { id: string; name: string; code: string }
export interface Agent {
  id: string; name: string; email: string;
  shift_id: string | null; shift: ShiftInfo | null;
  is_active: boolean;
  created_at: string; updated_at: string;
}
export interface AgentCreate { name: string; email: string; password: string; role?: string; shift_id?: string }
export interface AgentUpdate { name?: string; email?: string; shift_id?: string }

export const agentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAgents: build.query<Agent[], void>({
      query: () => '/agents',
      providesTags: ['Agent'],
    }),
    getAgent: build.query<Agent, string>({
      query: (id) => `/agents/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Agent', id }],
    }),
    createAgent: build.mutation<Agent, AgentCreate>({
      query: (body) => ({ url: '/agents', method: 'POST', body }),
      invalidatesTags: ['Agent'],
    }),
    updateAgent: build.mutation<Agent, { id: string; body: AgentUpdate }>({
      query: ({ id, body }) => ({ url: `/agents/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Agent'],
    }),
    deleteAgent: build.mutation<void, string>({
      query: (id) => ({ url: `/agents/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Agent'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAgentsQuery, useGetAgentQuery, useCreateAgentMutation, useUpdateAgentMutation, useDeleteAgentMutation } = agentsApi;
