import type { MakcorpsService } from '../makcorps/makcorps.service.js';
import type { GeoapifyService } from '../geoapify/geoapify.service.js';
import type { AviationStackService } from '../aviation-stack/aviation-stack.service.js';
import type { CuratedListingsService } from '../curated-listings/curated-listings.service.js';
import { createCuratedListingsService } from '../curated-listings/curated-listings.service.js';
import {
  createAviationStackAdapter,
  createCuratedListingAdapter,
  createGeoapifyAdapter,
  createMakcorpsAdapter,
  createRiyaConnectAdapter,
} from './travel-supply.adapters.js';
import type { TravelSupplyAdapter } from './travel-supply.types.js';

export interface TravelSupplyRegistryDeps {
  makcorps: MakcorpsService;
  geoapify: GeoapifyService;
  aviationStack: AviationStackService;
  curatedListings?: CuratedListingsService;
}

export function createTravelSupplyRegistry(deps: TravelSupplyRegistryDeps) {
  const curated = deps.curatedListings ?? createCuratedListingsService();
  const adapters: Record<string, TravelSupplyAdapter> = {
    makcorps: createMakcorpsAdapter(deps.makcorps),
    geoapify: createGeoapifyAdapter(deps.geoapify),
    aviation_stack: createAviationStackAdapter(deps.aviationStack),
    curated: createCuratedListingAdapter(curated),
    riya_connect: createRiyaConnectAdapter(),
  };

  return {
    get(id: string): TravelSupplyAdapter | undefined {
      return adapters[id];
    },
    all(): TravelSupplyAdapter[] {
      return Object.values(adapters);
    },
    curatedService: curated,
  };
}

export type TravelSupplyRegistry = ReturnType<typeof createTravelSupplyRegistry>;
