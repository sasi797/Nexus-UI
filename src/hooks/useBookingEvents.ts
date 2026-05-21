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
          dispatch(
            api.util.invalidateTags(
              bookingId
                ? [{ type: 'EmailMessage', id: bookingId }, { type: 'Booking', id: bookingId }]
                : ['EmailMessage', 'Booking']
            )
          );
        }
      } catch {
        // ignore malformed messages
      }
    };

    // Do NOT call es.close() here — EventSource auto-reconnects on error when left open
    es.onerror = () => {};

    return () => es.close();
  }, [token, dispatch]);
}
