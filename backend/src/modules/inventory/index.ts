// Inventory Module — Suppliers, services, options, pricing, availability, policies, locations
export { inventoryRoutes } from './inventory.routes.js';
export { createInventoryService } from './inventory.service.js';
export type {
  InventoryService,
  Supplier,
  CreateSupplierDto,
  SupplierFilters,
  Service,
  CreateServiceDto,
  ServiceFilters,
  ServiceOption,
  CreateOptionDto,
  ServicePrice,
  SetPriceDto,
  ServiceAvailability,
  SetAvailabilityDto,
  ServicePolicy,
  SetPolicyDto,
  Location,
  CreateLocationDto,
  LocationFilters,
} from './inventory.service.js';
