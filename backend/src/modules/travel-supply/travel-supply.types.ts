import type { ListingType } from '../curated-listings/curated-listings.types.js';

export interface SupplySearchRequest {
  product?: ListingType | 'hotel' | 'activity' | 'flight' | 'ticket' | 'itinerary';
  destinationSlug?: string;
  cityid?: string;
  checkin?: string;
  checkout?: string;
  travelers?: number;
  arrivalIata?: string;
  limit?: number;
}

export interface SupplyOffer {
  offerRef: string;
  provider: string;
  product: string;
  title: string;
  basePrice: number;
  currency: string;
  raw: unknown;
}

export interface Passenger {
  name: string;
  type: 'adult' | 'child';
}

export interface SupplyBookingResult {
  providerBookingRef: string;
  status: string;
  payload: Record<string, unknown>;
}

export interface TravelSupplyAdapter {
  id: string;
  search(input: SupplySearchRequest): Promise<SupplyOffer[]>;
  reprice(offerRef: string): Promise<SupplyOffer>;
  book(offerRef: string, passengers: Passenger[]): Promise<SupplyBookingResult>;
  cancel(providerBookingRef: string): Promise<void>;
}

export class NotImplementedSupplyError extends Error {
  constructor(adapterId: string, operation: string) {
    super(`${adapterId}.${operation} is not implemented yet`);
    this.name = 'NotImplementedSupplyError';
  }
}
