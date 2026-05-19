import { api } from './api';

export interface AgentBrief { id: string; name: string; email: string }
export interface Booking {
  id: string; subject: string; priority: string; status: string;
  agent: AgentBrief | null; agent_id: string | null; sender_email: string;
  cargo_type: string | null; pickup_location: string | null; delivery_location: string | null;
  cargo_weight: number | null; cargo_volume: number | null; shipping_mode: string | null;
  special_instructions: string | null; remarks: string | null;
  received_at: string; assigned_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
}
export interface BookingListItem {
  id: string; subject: string; priority: string; status: string;
  agent: AgentBrief | null; sender_email: string;
  received_at: string; assigned_at: string | null;
}
export interface BookingCreate {
  subject: string; priority: string; sender_email: string;
  cargo_type?: string; pickup_location?: string; delivery_location?: string;
  cargo_weight?: number; cargo_volume?: number; shipping_mode?: string;
  special_instructions?: string; remarks?: string;
}
export interface BookingUpdate extends Partial<BookingCreate> {
  status?: string; agent_id?: string;
}

export const bookingsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBookings: build.query<BookingListItem[], { status?: string; priority?: string; skip?: number; limit?: number }>({
      query: (params) => ({ url: '/bookings', params }),
      providesTags: ['Booking'],
    }),
    getBooking: build.query<Booking, string>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Booking', id }],
    }),
    createBooking: build.mutation<Booking, BookingCreate>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      invalidatesTags: ['Booking', 'Dashboard'],
    }),
    updateBooking: build.mutation<Booking, { id: string; body: BookingUpdate }>({
      query: ({ id, body }) => ({ url: `/bookings/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }, 'Booking', 'Dashboard'],
    }),
    patchBookingStatus: build.mutation<Booking, { id: string; status: string }>({
      query: ({ id, status }) => ({ url: `/bookings/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }, 'Booking', 'Dashboard'],
    }),
    deleteBooking: build.mutation<void, string>({
      query: (id) => ({ url: `/bookings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Booking', 'Dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBookingsQuery, useGetBookingQuery, useCreateBookingMutation,
  useUpdateBookingMutation, usePatchBookingStatusMutation, useDeleteBookingMutation,
} = bookingsApi;
