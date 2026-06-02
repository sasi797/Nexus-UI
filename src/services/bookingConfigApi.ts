import { api } from './api';

export interface BookingConfigItem {
  id: string;
  type: 'tag' | 'status' | 'priority';
  value: string;
  label: string;
  color: string;
  order_index: number;
}

export interface BookingConfigCreate {
  type: 'tag' | 'status' | 'priority';
  value: string;
  label: string;
  color: string;
  order_index?: number;
}

export interface BookingConfigUpdate {
  value?: string;
  label?: string;
  color?: string;
  order_index?: number;
}

export const AVAILABLE_COLORS = [
  'sky', 'violet', 'orange', 'amber', 'red', 'green', 'blue', 'gray', 'indigo', 'rose', 'emerald', 'pink',
] as const;
export type ConfigColor = typeof AVAILABLE_COLORS[number];

export const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; ring: string }> = {
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-400',     ring: 'ring-sky-200' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-400',  ring: 'ring-violet-200' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-400',  ring: 'ring-orange-200' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   ring: 'ring-amber-200' },
  red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     ring: 'ring-red-200' },
  green:   { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-500',   ring: 'ring-green-200' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-400',    ring: 'ring-blue-200' },
  gray:    { bg: 'bg-gray-100',   text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400',    ring: 'ring-gray-200' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-400',  ring: 'ring-indigo-200' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-400',    ring: 'ring-rose-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-400',    ring: 'ring-pink-200' },
};

export function getColor(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP['gray'];
}

export const bookingConfigApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBookingConfig: build.query<BookingConfigItem[], void>({
      query: () => '/booking-config',
      providesTags: ['BookingConfig' as never],
    }),
    createBookingConfig: build.mutation<BookingConfigItem, BookingConfigCreate>({
      query: (body) => ({ url: '/booking-config', method: 'POST', body }),
      invalidatesTags: ['BookingConfig' as never],
    }),
    updateBookingConfig: build.mutation<BookingConfigItem, { id: string; body: BookingConfigUpdate }>({
      query: ({ id, body }) => ({ url: `/booking-config/${id}`, method: 'PUT', body }),
      invalidatesTags: ['BookingConfig' as never],
    }),
    deleteBookingConfig: build.mutation<void, string>({
      query: (id) => ({ url: `/booking-config/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BookingConfig' as never],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBookingConfigQuery,
  useCreateBookingConfigMutation,
  useUpdateBookingConfigMutation,
  useDeleteBookingConfigMutation,
} = bookingConfigApi;
