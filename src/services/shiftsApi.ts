import { api } from './api';

export interface Shift {
  id: string; name: string; code: string;
  start_time: string; end_time: string;
  created_at: string; updated_at: string;
}
export interface ShiftCreate { name: string; code: string; start_time: string; end_time: string }
export interface ShiftUpdate { name?: string; code?: string; start_time?: string; end_time?: string }

export const shiftsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getShifts: build.query<Shift[], void>({
      query: () => '/shifts',
      providesTags: ['Shift'],
    }),
    createShift: build.mutation<Shift, ShiftCreate>({
      query: (body) => ({ url: '/shifts', method: 'POST', body }),
      invalidatesTags: ['Shift'],
    }),
    updateShift: build.mutation<Shift, { id: string; body: ShiftUpdate }>({
      query: ({ id, body }) => ({ url: `/shifts/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Shift'],
    }),
    deleteShift: build.mutation<void, string>({
      query: (id) => ({ url: `/shifts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Shift'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetShiftsQuery, useCreateShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation } = shiftsApi;
