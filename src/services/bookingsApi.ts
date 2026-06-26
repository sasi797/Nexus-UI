import { api } from './api';
import { notificationsApi } from './notificationsApi';

export interface AgentBrief { id: string; name: string; email: string }
export interface ParentBookingBrief { id: string; subject: string; }
export interface ChildBookingBrief { id: string; subject: string; status: string; da_number: string | null; }

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
  updated_at: string;
  last_email_at: string;
  is_read: boolean;
  has_reply: boolean;
  parent_booking_id: string | null;
  has_children: boolean;
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
  tags: string | null; account_code: string | null;
  received_at: string; assigned_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
  parent_booking_id: string | null;
  parent_booking: ParentBookingBrief | null;
  child_bookings: ChildBookingBrief[];
}

export interface BookingCreate {
  subject: string; priority: string; sender_email: string;
  parent_booking_id?: string;
  source_message_id?: string;
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
    getBookings: build.query<PaginatedBookings, { status?: string; priority?: string; sender_email?: string; agent_id?: string; search?: string; created_after?: string; closed_after?: string; tz?: string; page?: number; page_size?: number }>({
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
    setAccountCode: build.mutation<Booking, { id: string; code: string | null }>({
      query: ({ id, code }) => ({ url: `/bookings/${id}/account-code`, method: 'PATCH', body: { code } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Booking', id }],
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
    markBookingRead: build.mutation<void, string>({
      query: (id) => ({ url: `/bookings/${id}/mark-read`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Booking', id }, 'Booking', 'Notification'],
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData('getNotifications', undefined, (draft) => {
            if (draft.unread_bookings > 0) draft.unread_bookings -= 1;
          })
        );
        try { await queryFulfilled; } catch { patch.undo(); }
      },
    }),
    markAllBookingsRead: build.mutation<void, string[]>({
      query: (booking_ids) => ({ url: '/bookings/mark-all-read', method: 'POST', body: booking_ids }),
      invalidatesTags: ['Booking', 'Notification'],
      async onQueryStarted(_ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData('getNotifications', undefined, (draft) => {
            draft.unread_bookings = 0;
          })
        );
        try { await queryFulfilled; } catch { patch.undo(); }
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBookingsQuery, useGetBookingQuery, useCreateBookingMutation,
  useUpdateBookingMutation, usePatchBookingStatusMutation, useDeleteBookingMutation,
  useGetBookingEventsQuery, useAssignAgentMutation, useSetAccountCodeMutation, useAddSupportAgentMutation, useRemoveSupportAgentMutation,
  useMarkBookingReadMutation, useMarkAllBookingsReadMutation,
} = bookingsApi;
