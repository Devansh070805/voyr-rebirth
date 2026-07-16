import { createGeoapifyService } from '../geoapify/geoapify.service.js';
import { createMakcorpsService } from '../makcorps/makcorps.service.js';
import { createAviationStackService } from '../aviation-stack/aviation-stack.service.js';
import { createCuratedListingsService } from '../curated-listings/curated-listings.service.js';
import { createPricingService, type PricingService } from '../pricing/pricing.service.js';
import { createTripPlanService, type TripPlanService, type TripPlanServiceDeps } from './trip-plan.service.js';

export interface TripPlanModule {
  tripPlanService: TripPlanService;
  curatedListings: ReturnType<typeof createCuratedListingsService>;
  pricing: PricingService;
}

export interface TripPlanModuleOverrides extends Partial<TripPlanServiceDeps> {
  pricing?: PricingService;
}

export function createDefaultTripPlanModule(overrides?: TripPlanModuleOverrides): TripPlanModule {
  const curatedListings = overrides?.curatedListings ?? createCuratedListingsService();
  const pricing = createPricingService();
  const deps: TripPlanServiceDeps = {
    makcorps: overrides?.makcorps ?? createMakcorpsService(),
    geoapify: overrides?.geoapify ?? createGeoapifyService(),
    aviationStack: overrides?.aviationStack ?? createAviationStackService(),
    curatedListings,
  };
  return {
    tripPlanService: createTripPlanService(deps),
    curatedListings,
    pricing,
  };
}
