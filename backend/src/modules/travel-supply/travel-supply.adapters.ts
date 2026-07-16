import type { MakcorpsService } from '../makcorps/makcorps.service.js';
import { parsePrice } from '../../utils/format.js';
import type { GeoapifyService } from '../geoapify/geoapify.service.js';
import type { AviationStackService } from '../aviation-stack/aviation-stack.service.js';
import type { CuratedListingsService } from '../curated-listings/curated-listings.service.js';
import {
  NotImplementedSupplyError,
  type SupplyBookingResult,
  type SupplyOffer,
  type SupplySearchRequest,
  type TravelSupplyAdapter,
} from './travel-supply.types.js';

export function createMakcorpsAdapter(makcorps: MakcorpsService): TravelSupplyAdapter {
  return {
    id: 'makcorps',
    async search(input: SupplySearchRequest): Promise<SupplyOffer[]> {
      if (!input.cityid || !input.checkin || !input.checkout) return [];
      const result = await makcorps.searchHotels({
        cityid: input.cityid,
        checkin: input.checkin,
        checkout: input.checkout,
        adults: input.travelers ?? 2,
        rooms: 1,
        cur: 'USD',
        pagination: 0,
      });
      return result.hotels.slice(0, input.limit ?? 12).map((h, i) => {
        const price = parsePrice(h.price1 || h.price2);
        return {
          offerRef: `makcorps:hotel:${h.hotelId ?? i}`,
          provider: 'makcorps',
          product: 'hotel',
          title: h.name,
          basePrice: price,
          currency: 'USD',
          raw: h,
        };
      });
    },
    async reprice(offerRef: string): Promise<SupplyOffer> {
      throw new NotImplementedSupplyError('makcorps', `reprice(${offerRef})`);
    },
    async book(): Promise<SupplyBookingResult> {
      throw new NotImplementedSupplyError('makcorps', 'book');
    },
    async cancel(): Promise<void> {
      throw new NotImplementedSupplyError('makcorps', 'cancel');
    },
  };
}

export function createGeoapifyAdapter(geoapify: GeoapifyService): TravelSupplyAdapter {
  return {
    id: 'geoapify',
    async search(input: SupplySearchRequest): Promise<SupplyOffer[]> {
      if (!input.destinationSlug) return [];
      const places = await geoapify.searchPlaces({
        text: input.destinationSlug,
        categories: 'tourism.attraction,tourism.sights,entertainment,catering.restaurant',
        limit: input.limit ?? 12,
      });
      return places.map((p, i) => ({
        offerRef: `geoapify:place:${p.id ?? i}`,
        provider: 'geoapify',
        product: 'activity',
        title: p.name,
        basePrice: 0,
        currency: 'USD',
        raw: p,
      }));
    },
    async reprice(offerRef: string): Promise<SupplyOffer> {
      throw new NotImplementedSupplyError('geoapify', `reprice(${offerRef})`);
    },
    async book(): Promise<SupplyBookingResult> {
      throw new NotImplementedSupplyError('geoapify', 'book');
    },
    async cancel(): Promise<void> {
      throw new NotImplementedSupplyError('geoapify', 'cancel');
    },
  };
}

export function createAviationStackAdapter(aviation: AviationStackService): TravelSupplyAdapter {
  return {
    id: 'aviation_stack',
    async search(input: SupplySearchRequest): Promise<SupplyOffer[]> {
      if (!input.arrivalIata) return [];
      const routes = await aviation.getRoutes({
        limit: input.limit ?? 8,
        arrivalIata: input.arrivalIata,
      });
      return routes.data
        .slice(0, input.limit ?? 8)
        .map((r, i) => ({
          offerRef: `aviation:route:${r.route_id ?? i}`,
          provider: 'aviation_stack',
          product: 'flight',
          title: `${r.airline_iata} ${r.departure_airport_iata} → ${r.arrival_airport_iata}`,
          basePrice: 0,
          currency: 'USD',
          raw: r,
        }));
    },
    async reprice(offerRef: string): Promise<SupplyOffer> {
      throw new NotImplementedSupplyError('aviation_stack', `reprice(${offerRef})`);
    },
    async book(): Promise<SupplyBookingResult> {
      throw new NotImplementedSupplyError('aviation_stack', 'book');
    },
    async cancel(): Promise<void> {
      throw new NotImplementedSupplyError('aviation_stack', 'cancel');
    },
  };
}

export function createCuratedListingAdapter(curated: CuratedListingsService): TravelSupplyAdapter {
  return {
    id: 'curated',
    async search(input: SupplySearchRequest): Promise<SupplyOffer[]> {
      if (!input.destinationSlug) return [];
      const listings = await curated.listForDestination(
        input.destinationSlug,
        input.product === 'hotel' || input.product === 'activity' || input.product === 'flight' || input.product === 'ticket' || input.product === 'itinerary'
          ? input.product
          : undefined,
      );
      return listings.slice(0, input.limit ?? 20).map((l) => ({
        offerRef: `curated:${l.id}`,
        provider: 'curated',
        product: l.listing_type,
        title: l.title,
        basePrice: l.cost_price,
        currency: l.currency,
        raw: curated.toSnapshot(l),
      }));
    },
    async reprice(offerRef: string): Promise<SupplyOffer> {
      const id = offerRef.replace('curated:', '');
      const listing = await curated.getById(id);
      return {
        offerRef,
        provider: 'curated',
        product: listing.listing_type,
        title: listing.title,
        basePrice: listing.cost_price,
        currency: listing.currency,
        raw: curated.toSnapshot(listing),
      };
    },
    async book(offerRef: string): Promise<SupplyBookingResult> {
      return {
        providerBookingRef: offerRef,
        status: 'pending_manual',
        payload: { note: 'Curated listing — manual fulfillment required' },
      };
    },
    async cancel(): Promise<void> {
      /* manual cancel via admin ops */
    },
  };
}

export function createRiyaConnectAdapter(): TravelSupplyAdapter {
  return {
    id: 'riya_connect',
    async search(): Promise<SupplyOffer[]> {
      return [];
    },
    async reprice(offerRef: string): Promise<SupplyOffer> {
      throw new NotImplementedSupplyError('riya_connect', `reprice(${offerRef})`);
    },
    async book(): Promise<SupplyBookingResult> {
      throw new NotImplementedSupplyError('riya_connect', 'book');
    },
    async cancel(): Promise<void> {
      throw new NotImplementedSupplyError('riya_connect', 'cancel');
    },
  };
}
