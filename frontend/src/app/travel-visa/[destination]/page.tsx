import DestinationVisaClient from "./DestinationClient";

// Known destination codes for static export generation
// These cover all destinations seeded in the travel-visa database
const KNOWN_DESTINATIONS = [
  "SG", "TH", "VN", "AE", "JP", "IN", "TR", "FR", "GB", "US",
  "AU", "CA", "MX", "BR", "DE", "IT", "ES", "CH", "NL", "GR",
  "RU", "NZ", "CN", "HK", "KR", "MY", "ID", "PH", "KH", "NP",
  "QA", "OM", "SA", "KW", "BH", "EG", "ZA", "KE", "MA", "TN",
  "AR", "CL", "CO", "PE", "UY", "CR", "PA", "DO", "JM", "BB",
  "SE", "NO", "DK", "FI", "IS", "IE", "PT", "AT", "BE", "PL",
  "CZ", "HU", "RO", "BG", "HR", "RS", "EE", "LV", "LT", "LU",
  "MT", "CY", "SK", "SI", "AL", "MK", "BA", "ME", "XK",
];

export async function generateStaticParams() {
  return KNOWN_DESTINATIONS.map((code) => ({
    destination: code.toLowerCase(),
  }));
}

export default function DestinationVisaPage() {
  return <DestinationVisaClient />;
}
