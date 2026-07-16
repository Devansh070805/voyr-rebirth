export interface CuratedOptionMeta {
  source?: "curated" | "api";
  featured?: boolean;
  listing_id?: string;
  route_id?: string;
  name?: string;
  badges?: string[];
}

export function isVoyrPick(option: CuratedOptionMeta): boolean {
  return option.featured === true || option.source === "curated";
}

export function optionKey(option: CuratedOptionMeta): string {
  return option.listing_id || option.route_id || option.name || "";
}
