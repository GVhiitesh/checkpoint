export type UserRole = 'organizer' | 'attendee';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface EventItem {
  id: string;
  organizer_id: string;
  name: string;
  description?: string;
  event_date: string;
  capacity: number;
  registered_count: number;
  checked_in_count?: number;
  created_at: string;
}

export interface RegistrationItem {
  id: string;
  event_id: string;
  user_id?: string;
  event_name: string;
  event_date: string;
  checked_in_at: string | null;
  created_at: string;
}

export interface QRTokenResponse {
  checked_in: boolean;
  checked_in_at?: string;
  token?: string;
  short_code?: string;
  refresh_in_ms?: number;
}

export interface CheckInFeedItem {
  registration_id?: string;
  attendee_name: string;
  checked_in_at: string;
  station_id: string;
  source?: 'online' | 'offline_sync';
}

export interface ConflictItem {
  id: string;
  registration_id: string;
  event_id: string;
  detail: string;
  resolved: boolean;
  attendee_name?: string;
  created_at: string;
}

export interface EventStats {
  event_id: string;
  event_name: string;
  capacity: number;
  registered: number;
  checked_in: number;
  checked_in_pct: number;
  no_shows: number;
  no_show_pct: number;
  spots_left: number;
  first_check_in_at: string | null;
  last_check_in_at: string | null;
  peak_window_start: string | null;
  peak_window_count: number;
}

export interface AIInsightsResponse {
  answer: string | null;
  fallback: boolean;
  stats: EventStats;
  fallback_reason?: string;
}

export interface QueuedScan {
  client_scan_id: string;
  token: string;
  station_id: string;
  scanned_at: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  outcome?: string;
  error?: string;
}
