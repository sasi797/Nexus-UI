import { api } from './api';

export interface PendingQueueItem {
  id: string; booking_id: string; reason: string; pending_since: string;
}

export const pendingQueueApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPendingQueue: build.query<PendingQueueItem[], void>({
      query: () => '/pending-queue',
      providesTags: ['PendingQueue'],
    }),
    assignFromQueue: build.mutation<{ message: string }, { booking_id: string; agent_id: string }>({
      query: (body) => ({ url: '/pending-queue/assign', method: 'POST', body }),
      invalidatesTags: ['PendingQueue', 'Booking', 'Dashboard'],
    }),
    removeFromQueue: build.mutation<void, string>({
      query: (bookingId) => ({ url: `/pending-queue/${bookingId}`, method: 'DELETE' }),
      invalidatesTags: ['PendingQueue'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPendingQueueQuery, useAssignFromQueueMutation, useRemoveFromQueueMutation } = pendingQueueApi;
