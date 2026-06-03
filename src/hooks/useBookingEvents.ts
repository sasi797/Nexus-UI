import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { api } from '@/services/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function useBookingEvents(token: string | null) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return;

    const url = `${API_BASE}/events/bookings?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === 'new_booking') {
          dispatch(api.util.invalidateTags(['Booking', 'Dashboard']));

        } else if (data.type === 'new_message') {
          const bookingId: string | undefined = data.booking_id;
          const reopened: boolean = data.reopened === true;
          const tags: Parameters<typeof api.util.invalidateTags>[0] = bookingId
            ? [{ type: 'EmailMessage', id: bookingId }, { type: 'Booking', id: bookingId }]
            : ['EmailMessage', 'Booking'];
          if (reopened) {
            (tags as unknown[]).push('Booking', 'Dashboard');
          }
          dispatch(api.util.invalidateTags(tags));

        } else if (data.type === 'booking_event') {
          const bookingId: string | undefined = data.booking_id;
          const tags: Parameters<typeof api.util.invalidateTags>[0] = bookingId
            ? [{ type: 'Booking', id: bookingId }, 'Dashboard']
            : ['Booking', 'Dashboard'];
          dispatch(api.util.invalidateTags(tags));

        } else if (data.type === 'notification') {
          dispatch(api.util.invalidateTags(['Notification']));
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {};

    return () => es.close();
  }, [token, dispatch]);
}
