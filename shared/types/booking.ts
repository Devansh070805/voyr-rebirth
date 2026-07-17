export type BookingState =
  | 'Draft'
  | 'Requested'
  | 'Confirmed'
  | 'Paid'
  | 'Ticketed/booked'
  | 'Cancelled'
  | 'Refunded'
  | 'Failed';

export type AccountType = 'INDIVIDUAL' | 'AGENT' | 'CORPORATE';

export interface Booking {
  id: string;
  quote_id: string;
  status: BookingState;
  account_type?: AccountType;
  parent_account_ref?: string | null;
  traveler_ref?: string | null;
  booking_type?: string;
  source_provider?: string;
  destination?: string;
  travel_start_date?: Date | string;
  travel_end_date?: Date | string;
  created_at: string;
}
