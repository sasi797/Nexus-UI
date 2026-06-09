import { api } from './api';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface LatestUnreadBooking {
  id: string;
  subject: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unread_count: number;
  unread_bookings: number;
  latest_unread_booking?: LatestUnreadBooking | null;
}

export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<NotificationsResponse, void>({
      query: () => '/notifications',
      providesTags: ['Notification'],
    }),
    markRead: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
    markAllRead: build.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
    deleteNotification: build.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Notification'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  useDeleteNotificationMutation,
} = notificationsApi;
