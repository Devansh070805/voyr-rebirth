/** Resolve free-text destination names to ISO codes for visa checker links. */

const DESTINATION_CODES: { code: string; names: string[] }[] = [
  { code: "TH", names: ["thailand"] },
  { code: "VN", names: ["vietnam"] },
  { code: "MY", names: ["malaysia"] },
  { code: "SG", names: ["singapore"] },
  { code: "ID", names: ["indonesia", "bali"] },
  { code: "AE", names: ["uae", "dubai", "united arab emirates"] },
  { code: "JP", names: ["japan", "tokyo"] },
  { code: "KR", names: ["south korea", "korea"] },
  { code: "TR", names: ["turkey"] },
  { code: "AU", names: ["australia"] },
  { code: "NZ", names: ["new zealand"] },
  { code: "US", names: ["usa", "united states", "america"] },
  { code: "GB", names: ["uk", "united kingdom", "england", "london"] },
  { code: "FR", names: ["france", "paris"] },
  { code: "DE", names: ["germany"] },
  { code: "IT", names: ["italy"] },
  { code: "CH", names: ["switzerland"] },
  { code: "MV", names: ["maldives"] },
  { code: "LK", names: ["sri lanka"] },
  { code: "NP", names: ["nepal"] },
];

function resolveDestinationCode(destination: string | null): string | null {
  if (!destination) return null;
  const normalized = destination.trim().toLowerCase();
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  for (const entry of DESTINATION_CODES) {
    if (entry.names.some((n) => normalized.includes(n))) {
      return entry.code;
    }
  }
  return null;
}

export function visaCheckerHref(destination: string | null): string {
  const code = resolveDestinationCode(destination);
  if (code) return `/travel-visa?destination=${code}`;
  if (destination) return `/travel-visa?destination=${encodeURIComponent(destination)}`;
  return "/travel-visa";
}
