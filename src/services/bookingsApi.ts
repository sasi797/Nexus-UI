import { api } from './api';

export interface AgentBrief { id: string; name: string; email: string }

export interface BookingListItem {
  id: string;
  subject: string;
  priority: string;
  status: string;
  agent: AgentBrief | null;
  support_agents: AgentBrief[];
  sender_email: string;
  da_number: string | null;
  da_description: string | null;
  tags: string | null;
  received_at: string;
  assigned_at: string | null;
  completed_at: string | null;
}

export interface PaginatedBookings {
  items: BookingListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Booking {
  id: string; subject: string; priority: string; status: string;
  agent_id: string | null; agent: AgentBrief | null; support_agents: AgentBrief[];
  sender_email: string; da_number: string | null; da_description: string | null;
  tags: string | null;
  received_at: string; assigned_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
}

export interface BookingCreate {
  subject: string; priority: string; sender_email: string;
}

export interface BookingUpdate extends Partial<BookingCreate> {
  status?: string; agent_id?: string | null; tags?: string;
}

export interface BookingEvent {
  id: number;
  event: string;
  actor_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export const bookingsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBookings: build.query<PaginatedBookings, { status?: string; priority?: string; sender_email?: string; agent_id?: string; search?: string; created_after?: string; closed_after?: string; page?: number; page_size?: number }>({
      query: (params) => ({ url: '/bookings', params }),
      // Handle both old (plain array) and new (paginated object) backend responses
      transformResponse: (raw: PaginatedBookings | BookingListItem[]) => {
        if (Array.isArray(raw)) {
          return {
            items: raw,
            total: raw.length,
            page: 1,
            page_size: raw.length || 1,
            total_pages: 1,
          };
        }
        return raw;
      },
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
    patchBookingStatus: build.mutation<Booking, { id: string; status: string; da_number?: string; da_description?: string }>({
      query: ({ id, status, da_number, da_description }) => ({
        url: `/bookings/${id}/status`,
        method: 'PATCH',
        body: { status, da_number, da_description },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }, 'Booking', 'Dashboard'],
    }),
    deleteBooking: build.mutation<void, string>({
      query: (id) => ({ url: `/bookings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Booking', 'Dashboard'],
    }),
    getBookingEvents: build.query<BookingEvent[], string>({
      query: (id) => `/bookings/${id}/events`,
      providesTags: (_r, _e, id) => [{ type: 'Booking', id }],
    }),
    assignAgent: build.mutation<Booking, { id: string; agent_id: string | null }>({
      query: ({ id, agent_id }) => ({ url: `/bookings/${id}/assign`, method: 'PATCH', body: { agent_id } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }, 'Booking', 'Dashboard'],
    }),
    addSupportAgent: build.mutation<Booking, { id: string; agent_id: string }>({
      query: ({ id, agent_id }) => ({ url: `/bookings/${id}/support-agents`, method: 'POST', body: { agent_id } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }, 'Booking'],
    }),
    removeSupportAgent: build.mutation<Booking, { id: string; agent_id: string }>({
      query: ({ id, agent_id }) => ({ url: `/bookings/${id}/support-agents/${agent_id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }, 'Booking'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBookingsQuery, useGetBookingQuery, useCreateBookingMutation,
  useUpdateBookingMutation, usePatchBookingStatusMutation, useDeleteBookingMutation,
  useGetBookingEventsQuery, useAssignAgentMutation, useAddSupportAgentMutation, useRemoveSupportAgentMutation,
} = bookingsApi;
