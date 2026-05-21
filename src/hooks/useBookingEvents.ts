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
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      // EventSource automatically reconnects after close
      es.close();
    };

    return () => es.close();
  }, [token, dispatch]);
}
