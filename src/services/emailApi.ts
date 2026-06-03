import { api } from './api';

export interface EmailAttachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number | null;
}

export interface EmailMessage {
  id: string;
  booking_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  cc_emails: string | null;
  sent_at: string;
  attachments: EmailAttachment[];
}

export const emailApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMessages: build.query<EmailMessage[], string>({
      query: (bookingId) => `/bookings/${bookingId}/messages`,
      providesTags: (_r, _e, bookingId) => [{ type: 'EmailMessage', id: bookingId }],
    }),
    replyMessage: build.mutation<EmailMessage, { bookingId: string; formData: FormData }>({
      query: ({ bookingId, formData }) => ({
        url: `/bookings/${bookingId}/reply`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: (_r, _e, { bookingId }) => [{ type: 'EmailMessage', id: bookingId }],
    }),
    syncEmails: build.mutation<{ synced: number }, string>({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/sync-emails`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, bookingId) => [{ type: 'EmailMessage', id: bookingId }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetMessagesQuery, useReplyMessageMutation, useSyncEmailsMutation } = emailApi;
