export type Priority = 'Very Urgent' | 'Urgent' | 'Not Urgent';
export type BookingStatus = 'In Progress' | 'Pending' | 'Completed';
export type AttendanceStatus = 'Present' | 'Absent' | 'On Break' | 'Late';

export interface Booking {
  id: string;
  subject: string;
  priority: Priority;
  status: BookingStatus;
  assignedAt: string;
  assignedDate: string;
  agent: string | null;
  senderEmail: string;
  receivedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  status: AttendanceStatus;
  shift: string;
}

export interface AllocationLog {
  bookingId: string;
  assignedAgent: string;
  pointerValue: number;
  poolSize: number;
  allocatedAt: string;
}

export interface PendingQueueItem {
  bookingId: string;
  reason: string;
  pendingSince: string;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
}

export interface ReportTrend {
  date: string;
  received: number;
  completed: number;
}

export const bookings: Booking[] = [
  {
    id: 'BKG-2026-00147',
    subject: 'Export to Dubai',
    priority: 'Very Urgent',
    status: 'In Progress',
    assignedAt: '9:15 AM',
    assignedDate: '6 May 2026',
    agent: 'James Wilson',
    senderEmail: 'client@example.com',
    receivedAt: '6 May 2026, 09:15 AM',
  },
  {
    id: 'BKG-2026-00146',
    subject: 'Import from China',
    priority: 'Urgent',
    status: 'Pending',
    assignedAt: '8:42 AM',
    assignedDate: '6 May 2026',
    agent: 'Sophie Martin',
    senderEmail: 'importer@logistics.com',
    receivedAt: '6 May 2026, 08:42 AM',
  },
  {
    id: 'BKG-2026-00145',
    subject: 'Local Delivery',
    priority: 'Not Urgent',
    status: 'In Progress',
    assignedAt: '8:10 AM',
    assignedDate: '6 May 2026',
    agent: 'Carlos Mendes',
    senderEmail: 'delivery@local.com',
    receivedAt: '6 May 2026, 08:10 AM',
  },
  {
    id: 'BKG-2026-00144',
    subject: 'Export to USA',
    priority: 'Very Urgent',
    status: 'Completed',
    assignedAt: '7:30 AM',
    assignedDate: '6 May 2026',
    agent: 'James Wilson',
    senderEmail: 'usa@exports.com',
    receivedAt: '6 May 2026, 07:30 AM',
  },
  {
    id: 'BKG-2026-00143',
    subject: 'Machinery Import',
    priority: 'Urgent',
    status: 'Pending',
    assignedAt: '6:55 AM',
    assignedDate: '6 May 2026',
    agent: null,
    senderEmail: 'machinery@imports.com',
    receivedAt: '6 May 2026, 06:55 AM',
  },
  {
    id: 'BKG-2026-00142',
    subject: 'Pharma Shipment',
    priority: 'Very Urgent',
    status: 'Completed',
    assignedAt: '6:20 AM',
    assignedDate: '5 May 2026',
    agent: 'Sophie Martin',
    senderEmail: 'pharma@health.com',
    receivedAt: '5 May 2026, 06:20 AM',
  },
  {
    id: 'BKG-2026-00141',
    subject: 'Cold Chain Logistics',
    priority: 'Urgent',
    status: 'Completed',
    assignedAt: '5:45 AM',
    assignedDate: '5 May 2026',
    agent: 'Carlos Mendes',
    senderEmail: 'cold@chain.com',
    receivedAt: '5 May 2026, 05:45 AM',
  },
  {
    id: 'BKG-2026-00150',
    subject: 'Textile Export',
    priority: 'Not Urgent',
    status: 'Pending',
    assignedAt: '9:20 AM',
    assignedDate: '6 May 2026',
    agent: null,
    senderEmail: 'textile@export.com',
    receivedAt: '6 May 2026, 09:20 AM',
  },
  {
    id: 'BKG-2026-00149',
    subject: 'Auto Parts Import',
    priority: 'Urgent',
    status: 'Pending',
    assignedAt: '9:18 AM',
    assignedDate: '6 May 2026',
    agent: null,
    senderEmail: 'autoparts@import.com',
    receivedAt: '6 May 2026, 09:18 AM',
  },
  {
    id: 'BKG-2026-00148',
    subject: 'Food Commodities',
    priority: 'Not Urgent',
    status: 'Pending',
    assignedAt: '9:10 AM',
    assignedDate: '6 May 2026',
    agent: null,
    senderEmail: 'food@commodities.com',
    receivedAt: '6 May 2026, 09:10 AM',
  },
];

export const bookingDetail = {
  id: 'BKG-2026-00147',
  status: 'In Progress' as BookingStatus,
  senderEmail: 'client@example.com',
  subject: 'Export to Dubai',
  received: '6 May 2026, 09:15 AM',
  cargoType: 'Electronics',
  pickupLocation: 'Mumbai, India',
  deliveryLocation: 'Dubai, UAE',
  cargoWeight: '1250',
  cargoVolume: '3.5',
  shippingMode: 'Air Freight',
  specialInstructions: 'Handle with care. Fragile items.',
  remarks: 'Customer requested early delivery.',
};

export const agents: Agent[] = [
  { id: 'a1', name: 'James Wilson', email: 'james@bts.com', status: 'Present', shift: 'Morning Shift' },
  { id: 'a2', name: 'Sophie Martin', email: 'sophie@bts.com', status: 'Present', shift: 'Morning Shift' },
  { id: 'a3', name: 'Carlos Mendes', email: 'carlos@bts.com', status: 'Present', shift: 'Morning Shift' },
  { id: 'a4', name: 'Lena Thomas', email: 'lena@bts.com', status: 'Absent', shift: 'Morning Shift' },
  { id: 'a5', name: 'Arjun Patel', email: 'arjun@bts.com', status: 'On Break', shift: 'Morning Shift' },
  { id: 'a6', name: 'Maria Garcia', email: 'maria@bts.com', status: 'Late', shift: 'Morning Shift' },
];

export const allocationLog: AllocationLog[] = [
  { bookingId: 'BKG-2026-00147', assignedAgent: 'James Wilson', pointerValue: 0, poolSize: 3, allocatedAt: '6 May 2026, 09:15 AM' },
  { bookingId: 'BKG-2026-00146', assignedAgent: 'Sophie Martin', pointerValue: 1, poolSize: 3, allocatedAt: '6 May 2026, 09:12 AM' },
  { bookingId: 'BKG-2026-00145', assignedAgent: 'Carlos Mendes', pointerValue: 2, poolSize: 3, allocatedAt: '6 May 2026, 09:10 AM' },
  { bookingId: 'BKG-2026-00144', assignedAgent: 'James Wilson', pointerValue: 0, poolSize: 3, allocatedAt: '6 May 2026, 09:05 AM' },
];

export const pendingQueue: PendingQueueItem[] = [
  { bookingId: 'BKG-2026-00150', reason: 'No agents available', pendingSince: '6 May 2026, 09:20 AM' },
  { bookingId: 'BKG-2026-00149', reason: 'All agents busy', pendingSince: '6 May 2026, 09:18 AM' },
  { bookingId: 'BKG-2026-00148', reason: 'No agents available', pendingSince: '6 May 2026, 09:10 AM' },
  { bookingId: 'BKG-2026-00143', reason: 'All agents busy', pendingSince: '6 May 2026, 06:55 AM' },
  { bookingId: 'BKG-2026-00141', reason: 'No agents available', pendingSince: '5 May 2026, 05:45 AM' },
];

export const shifts: Shift[] = [
  { id: 's1', name: 'Morning Shift', code: 'MOR', startTime: '06:00', endTime: '14:00' },
  { id: 's2', name: 'Afternoon Shift', code: 'AFT', startTime: '14:00', endTime: '22:00' },
  { id: 's3', name: 'Night Shift', code: 'NIT', startTime: '22:00', endTime: '06:00' },
];

export const reportsTrend: ReportTrend[] = [
  { date: '1 May', received: 82, completed: 70 },
  { date: '2 May', received: 95, completed: 88 },
  { date: '3 May', received: 78, completed: 65 },
  { date: '4 May', received: 110, completed: 95 },
  { date: '5 May', received: 98, completed: 80 },
  { date: '6 May', received: 79, completed: 22 },
];

export const priorityDistribution = [
  { name: 'Very Urgent', value: 35, color: '#ef4444' },
  { name: 'Urgent', value: 45, color: '#f59e0b' },
  { name: 'Not Urgent', value: 20, color: '#22c55e' },
];

export const dashboardStats = {
  totalBookings: 128,
  pending: 45,
  inProgress: 32,
  completed: 51,
};
