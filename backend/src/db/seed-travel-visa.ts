import type { Pool } from 'pg';

const COUNTRIES = [
  { iso_code: 'TH', name: 'Thailand', flag_emoji: '🇹🇭', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://www.thaievisa.go.th/', currency: 'THB', languages: ['Thai'] },
  { iso_code: 'VN', name: 'Vietnam', flag_emoji: '🇻🇳', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://evisa.xuatnhapcanh.gov.vn/', currency: 'VND', languages: ['Vietnamese'] },
  { iso_code: 'MY', name: 'Malaysia', flag_emoji: '🇲🇾', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'MYR', languages: ['Malay', 'English'] },
  { iso_code: 'SG', name: 'Singapore', flag_emoji: '🇸🇬', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: true, eta_url: 'https://www.ica.gov.sg/', official_visa_url: null, currency: 'SGD', languages: ['English', 'Chinese'] },
  { iso_code: 'ID', name: 'Indonesia', flag_emoji: '🇮🇩', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://molina.imigrasi.go.id/', currency: 'IDR', languages: ['Indonesian'] },
  { iso_code: 'AE', name: 'United Arab Emirates', flag_emoji: '🇦🇪', region: 'Asia', subregion: 'Western Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'AED', languages: ['Arabic', 'English'] },
  { iso_code: 'JP', name: 'Japan', flag_emoji: '🇯🇵', region: 'Asia', subregion: 'Eastern Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://www.mofa.go.jp/', currency: 'JPY', languages: ['Japanese'] },
  { iso_code: 'KR', name: 'South Korea', flag_emoji: '🇰🇷', region: 'Asia', subregion: 'Eastern Asia', is_popular_destination: true, requires_eta: true, eta_url: 'https://www.k-eta.go.kr/', official_visa_url: null, currency: 'KRW', languages: ['Korean'] },
  { iso_code: 'IN', name: 'India', flag_emoji: '🇮🇳', region: 'Asia', subregion: 'Southern Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://indianvisaonline.gov.in/', currency: 'INR', languages: ['Hindi', 'English'] },
  { iso_code: 'TR', name: 'Turkey', flag_emoji: '🇹🇷', region: 'Asia', subregion: 'Western Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://www.evisa.gov.tr/', currency: 'TRY', languages: ['Turkish'] },
  { iso_code: 'AU', name: 'Australia', flag_emoji: '🇦🇺', region: 'Oceania', subregion: 'Australia', is_popular_destination: true, requires_eta: true, eta_url: 'https://immi.homeaffairs.gov.au/', official_visa_url: null, currency: 'AUD', languages: ['English'] },
  { iso_code: 'NZ', name: 'New Zealand', flag_emoji: '🇳🇿', region: 'Oceania', subregion: 'New Zealand', is_popular_destination: true, requires_eta: true, eta_url: 'https://www.immigration.govt.nz/', official_visa_url: null, currency: 'NZD', languages: ['English'] },
  { iso_code: 'FR', name: 'France', flag_emoji: '🇫🇷', region: 'Europe', subregion: 'Western Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'EUR', languages: ['French'] },
  { iso_code: 'DE', name: 'Germany', flag_emoji: '🇩🇪', region: 'Europe', subregion: 'Western Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'EUR', languages: ['German'] },
  { iso_code: 'IT', name: 'Italy', flag_emoji: '🇮🇹', region: 'Europe', subregion: 'Southern Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'EUR', languages: ['Italian'] },
  { iso_code: 'ES', name: 'Spain', flag_emoji: '🇪🇸', region: 'Europe', subregion: 'Southern Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'EUR', languages: ['Spanish'] },
  { iso_code: 'GB', name: 'United Kingdom', flag_emoji: '🇬🇧', region: 'Europe', subregion: 'Northern Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://www.gov.uk/check-uk-visa', currency: 'GBP', languages: ['English'] },
  { iso_code: 'CH', name: 'Switzerland', flag_emoji: '🇨🇭', region: 'Europe', subregion: 'Western Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'CHF', languages: ['German', 'French'] },
  { iso_code: 'NL', name: 'Netherlands', flag_emoji: '🇳🇱', region: 'Europe', subregion: 'Western Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'EUR', languages: ['Dutch'] },
  { iso_code: 'GR', name: 'Greece', flag_emoji: '🇬🇷', region: 'Europe', subregion: 'Southern Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'EUR', languages: ['Greek'] },
  { iso_code: 'US', name: 'United States', flag_emoji: '🇺🇸', region: 'Americas', subregion: 'Northern America', is_popular_destination: true, requires_eta: true, eta_url: 'https://esta.cbp.dhs.gov/', official_visa_url: null, currency: 'USD', languages: ['English'] },
  { iso_code: 'CA', name: 'Canada', flag_emoji: '🇨🇦', region: 'Americas', subregion: 'Northern America', is_popular_destination: true, requires_eta: true, eta_url: 'https://www.canada.ca/', official_visa_url: null, currency: 'CAD', languages: ['English', 'French'] },
  { iso_code: 'MX', name: 'Mexico', flag_emoji: '🇲🇽', region: 'Americas', subregion: 'Central America', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'MXN', languages: ['Spanish'] },
  { iso_code: 'BR', name: 'Brazil', flag_emoji: '🇧🇷', region: 'Americas', subregion: 'South America', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'BRL', languages: ['Portuguese'] },
  { iso_code: 'EG', name: 'Egypt', flag_emoji: '🇪🇬', region: 'Africa', subregion: 'Northern Africa', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://www.visa2egypt.gov.eg/', currency: 'EGP', languages: ['Arabic'] },
  { iso_code: 'ZA', name: 'South Africa', flag_emoji: '🇿🇦', region: 'Africa', subregion: 'Southern Africa', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'ZAR', languages: ['English'] },
  { iso_code: 'MA', name: 'Morocco', flag_emoji: '🇲🇦', region: 'Africa', subregion: 'Northern Africa', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'MAD', languages: ['Arabic', 'French'] },
  { iso_code: 'KE', name: 'Kenya', flag_emoji: '🇰🇪', region: 'Africa', subregion: 'Eastern Africa', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://evisa.go.ke/', currency: 'KES', languages: ['English', 'Swahili'] },
  { iso_code: 'MU', name: 'Mauritius', flag_emoji: '🇲🇺', region: 'Africa', subregion: 'Eastern Africa', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'MUR', languages: ['English', 'French'] },
  { iso_code: 'SA', name: 'Saudi Arabia', flag_emoji: '🇸🇦', region: 'Asia', subregion: 'Western Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: 'https://visa.visitsaudi.com/', currency: 'SAR', languages: ['Arabic'] },
  { iso_code: 'QA', name: 'Qatar', flag_emoji: '🇶🇦', region: 'Asia', subregion: 'Western Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'QAR', languages: ['Arabic'] },
  { iso_code: 'CN', name: 'China', flag_emoji: '🇨🇳', region: 'Asia', subregion: 'Eastern Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'CNY', languages: ['Chinese'] },
  { iso_code: 'HK', name: 'Hong Kong', flag_emoji: '🇭🇰', region: 'Asia', subregion: 'Eastern Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'HKD', languages: ['Chinese', 'English'] },
  { iso_code: 'PH', name: 'Philippines', flag_emoji: '🇵🇭', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'PHP', languages: ['Filipino', 'English'] },
  { iso_code: 'KH', name: 'Cambodia', flag_emoji: '🇰🇭', region: 'Asia', subregion: 'Southeast Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'KHR', languages: ['Khmer'] },
  { iso_code: 'NP', name: 'Nepal', flag_emoji: '🇳🇵', region: 'Asia', subregion: 'Southern Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'NPR', languages: ['Nepali'] },
  { iso_code: 'LK', name: 'Sri Lanka', flag_emoji: '🇱🇰', region: 'Asia', subregion: 'Southern Asia', is_popular_destination: true, requires_eta: true, eta_url: 'https://eta.gov.lk/', official_visa_url: null, currency: 'LKR', languages: ['Sinhala', 'Tamil'] },
  { iso_code: 'MV', name: 'Maldives', flag_emoji: '🇲🇻', region: 'Asia', subregion: 'Southern Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'MVR', languages: ['Dhivehi'] },
  { iso_code: 'RU', name: 'Russia', flag_emoji: '🇷🇺', region: 'Europe', subregion: 'Eastern Europe', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'RUB', languages: ['Russian'] },
  { iso_code: 'GE', name: 'Georgia', flag_emoji: '🇬🇪', region: 'Asia', subregion: 'Western Asia', is_popular_destination: true, requires_eta: false, eta_url: null, official_visa_url: null, currency: 'GEL', languages: ['Georgian'] },
];

type VisaReq = { passport_country: string; destination_country: string; visa_status: string; visa_type: string | null; max_stay_days: number | null; notes: string; official_source_url: string | null; last_verified: string };

const V = (p: string, d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null): VisaReq =>
  ({ passport_country: p, destination_country: d, visa_status: s, visa_type: t, max_stay_days: days, notes, official_source_url: url, last_verified: '2026-05-01' });

const IN = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('IN', d, s, t, days, notes, url);
const US = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('US', d, s, t, days, notes, url);
const GB = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('GB', d, s, t, days, notes, url);
const AE = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('AE', d, s, t, days, notes, url);
const AU = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('AU', d, s, t, days, notes, url);
const CA = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('CA', d, s, t, days, notes, url);
const JP = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('JP', d, s, t, days, notes, url);
const CN = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('CN', d, s, t, days, notes, url);
const RU = (d: string, s: string, t: string | null, days: number | null, notes: string, url: string | null = null) => V('RU', d, s, t, days, notes, url);

const VISA_REQUIREMENTS: VisaReq[] = [
  IN('TH', 'visa_free', null, 60, 'Visa exemption for tourism.', 'https://www.thaievisa.go.th/'),
  IN('MY', 'visa_free', null, 30, 'Visa-free entry for tourism.'),
  IN('MV', 'visa_free', null, 90, 'Free visa on arrival.'),
  IN('MU', 'visa_free', null, 60, 'Visa on arrival for tourism.'),
  IN('NP', 'visa_free', null, 150, 'No visa required for Indian citizens.'),
  IN('GE', 'visa_free', null, 90, 'Visa-free for tourism.'),
  IN('ID', 'visa_on_arrival', 'VoA', 30, 'Fee USD 35. Extendable once.', 'https://molina.imigrasi.go.id/'),
  IN('KH', 'visa_on_arrival', 'VoA', 30, 'Fee USD 30.'),
  IN('LK', 'eta_required', 'ETA', 30, 'ETA required. Free for SAARC.', 'https://eta.gov.lk/'),
  IN('TR', 'evisa_available', 'e-Visa', 30, 'Apply online. Fee ~USD 50.', 'https://www.evisa.gov.tr/'),
  IN('VN', 'evisa_available', 'e-Visa', 90, 'E-visa valid for 90 days.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  IN('EG', 'evisa_available', 'e-Visa', 30, 'Apply online.', 'https://www.visa2egypt.gov.eg/'),
  IN('KE', 'evisa_available', 'e-Visa', 90, 'Apply at evisa.go.ke.', 'https://evisa.go.ke/'),
  IN('SA', 'evisa_available', 'e-Visa', 90, 'Tourist e-visa available.', 'https://visa.visitsaudi.com/'),
  IN('US', 'visa_required', 'B1/B2', 180, 'Interview required at embassy.'),
  IN('GB', 'visa_required', 'Standard Visitor', 180, 'Apply online. Biometrics required.', 'https://www.gov.uk/check-uk-visa'),
  IN('CA', 'visa_required', 'Visitor', 180, 'Apply online.'),
  IN('FR', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('DE', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('IT', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('ES', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('CH', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('NL', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('GR', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  IN('JP', 'visa_required', 'Tourist', 90, 'Apply at Japanese embassy.', 'https://www.mofa.go.jp/'),
  IN('KR', 'visa_required', 'Tourist', 90, 'Apply at Korean embassy.'),
  IN('CN', 'visa_required', 'Tourist', 30, 'Apply at Chinese embassy.'),
  IN('RU', 'visa_required', 'Tourist', 30, 'Apply at Russian embassy.'),
  IN('ZA', 'visa_required', 'Visitor', 90, 'Apply at South African embassy.'),
  IN('BR', 'visa_required', 'Tourist', 90, 'Apply at Brazilian embassy.'),
  IN('AU', 'visa_required', 'Visitor 600', 90, 'Electronic visa available.', 'https://immi.homeaffairs.gov.au/'),
  IN('NZ', 'visa_required', 'Visitor', 90, 'Apply online.', 'https://www.immigration.govt.nz/'),
  IN('AE', 'visa_required', 'Tourist', 30, 'Apply online or through airline.'),
  IN('SG', 'visa_required', 'Tourist', 30, 'Apply through authorized agents.', 'https://www.ica.gov.sg/'),
  IN('QA', 'visa_required', 'Tourist', 30, 'Apply through Qatar portal.'),
  IN('MX', 'visa_required', 'Tourist', 180, 'Apply at Mexican embassy.'),
  IN('PH', 'visa_required', 'Tourist', 30, 'Apply at Philippine embassy.'),

  US('GB', 'visa_free', null, 180, 'Visa-free for tourism.'),
  US('FR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('DE', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('IT', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('ES', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('NL', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('GR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('CH', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  US('JP', 'visa_free', null, 90, 'Visa-free for tourism.'),
  US('KR', 'visa_free', null, 90, 'Visa-free for tourism (K-ETA may apply).', 'https://www.k-eta.go.kr/'),
  US('SG', 'visa_free', null, 90, 'Visa-free for US citizens.'),
  US('MY', 'visa_free', null, 90, 'Visa-free for tourism.'),
  US('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  US('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  US('AU', 'eta_required', 'ETA', 90, 'ETA required.', 'https://immi.homeaffairs.gov.au/'),
  US('NZ', 'eta_required', 'NZeTA', 90, 'NZeTA required.', 'https://www.immigration.govt.nz/'),
  US('CA', 'visa_free', null, 180, 'Visa-free for tourism.'),
  US('MX', 'visa_free', null, 180, 'Visa-free for tourism.'),
  US('BR', 'visa_free', null, 90, 'Visa-free for tourism.'),
  US('AE', 'visa_free', null, 30, 'Visa on arrival. Free.'),
  US('TR', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://www.evisa.gov.tr/'),
  US('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  US('VN', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  US('EG', 'evisa_available', 'e-Visa', 30, 'E-visa available.', 'https://www.visa2egypt.gov.eg/'),
  US('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  US('CN', 'visa_required', 'Tourist', 60, 'Visa required.'),
  US('RU', 'visa_required', 'Tourist', 30, 'Visa required.'),
  US('ID', 'visa_free', null, 30, 'Visa-free for tourism.'),
  US('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  US('ZA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  US('KE', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.go.ke/'),
  US('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  US('NP', 'visa_on_arrival', 'VoA', 150, 'Visa on arrival for tourism.', 'https://www.immigration.gov.np/'),
  US('HK', 'visa_free', null, 90, 'Visa-free for tourism.'),
  US('GE', 'visa_free', null, 365, 'Visa-free for tourism.'),

  GB('FR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('DE', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('IT', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('ES', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('NL', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('GR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('CH', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  GB('JP', 'visa_free', null, 180, 'Visa-free for tourism.'),
  GB('KR', 'visa_free', null, 90, 'Visa-free for tourism (K-ETA may apply).', 'https://www.k-eta.go.kr/'),
  GB('SG', 'visa_free', null, 90, 'Visa-free for UK citizens.'),
  GB('MY', 'visa_free', null, 90, 'Visa-free for tourism.'),
  GB('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  GB('US', 'visa_free', null, 90, 'Visa-free for tourism (ESTA required).', 'https://esta.cbp.dhs.gov/'),
  GB('CA', 'eta_required', 'eTA', 180, 'eTA required.', 'https://www.canada.ca/'),
  GB('AU', 'eta_required', 'ETA', 90, 'ETA required.', 'https://immi.homeaffairs.gov.au/'),
  GB('NZ', 'eta_required', 'NZeTA', 90, 'NZeTA required.', 'https://www.immigration.govt.nz/'),
  GB('AE', 'visa_free', null, 30, 'Visa on arrival. Free.'),
  GB('TR', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://www.evisa.gov.tr/'),
  GB('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  GB('VN', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  GB('EG', 'evisa_available', 'e-Visa', 30, 'E-visa available.', 'https://www.visa2egypt.gov.eg/'),
  GB('CN', 'visa_required', 'Tourist', 30, 'Visa required.'),
  GB('RU', 'visa_required', 'Tourist', 30, 'Visa required.'),
  GB('ID', 'visa_free', null, 30, 'Visa-free for tourism.'),
  GB('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  GB('ZA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  GB('KE', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.go.ke/'),
  GB('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  GB('NP', 'visa_on_arrival', 'VoA', 150, 'Visa on arrival.'),
  GB('MX', 'visa_free', null, 180, 'Visa-free for tourism.'),
  GB('BR', 'visa_free', null, 90, 'Visa-free for tourism.'),
  GB('HK', 'visa_free', null, 180, 'Visa-free for tourism.'),
  GB('GE', 'visa_free', null, 365, 'Visa-free for tourism.'),
  GB('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  GB('QA', 'visa_free', null, 30, 'Visa-free for tourism.'),
  GB('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  GB('MU', 'visa_free', null, 90, 'Visa-free for tourism.'),
  GB('MA', 'visa_free', null, 90, 'Visa-free for tourism.'),

  AE('GB', 'visa_free', null, 180, 'Visa-free for tourism.'),
  AE('FR', 'visa_free', null, 90, 'Visa-free (Schengen).'),
  AE('DE', 'visa_free', null, 90, 'Visa-free (Schengen).'),
  AE('IT', 'visa_free', null, 90, 'Visa-free (Schengen).'),
  AE('ES', 'visa_free', null, 90, 'Visa-free (Schengen).'),
  AE('CH', 'visa_free', null, 90, 'Visa-free (Schengen).'),
  AE('JP', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('KR', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('SG', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('MY', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('TR', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://www.evisa.gov.tr/'),
  AE('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  AE('VN', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  AE('EG', 'evisa_available', 'e-Visa', 30, 'E-visa available.', 'https://www.visa2egypt.gov.eg/'),
  AE('CN', 'visa_required', 'Tourist', 30, 'Visa required.'),
  AE('RU', 'visa_required', 'Tourist', 30, 'Visa required.'),
  AE('ID', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  AE('ZA', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AE('KE', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.go.ke/'),
  AE('US', 'visa_required', 'B1/B2', 180, 'Visa required.'),
  AE('CA', 'visa_required', 'Visitor', 180, 'Visa required.'),
  AE('AU', 'visa_required', 'Visitor 600', 90, 'Visa required.'),
  AE('NZ', 'visa_required', 'Visitor', 90, 'Visa required.'),
  AE('GE', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AE('QA', 'visa_free', null, 30, 'Visa-free for GCC residents.'),
  AE('SA', 'visa_free', null, 30, 'Visa-free for GCC residents.'),
  AE('NP', 'visa_on_arrival', 'VoA', 30, 'Visa on arrival.'),
  AE('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  AE('MX', 'visa_required', 'Tourist', 180, 'Visa required.'),
  AE('BR', 'visa_required', 'Tourist', 90, 'Visa required.'),

  AU('GB', 'visa_free', null, 180, 'Visa-free for tourism.'),
  AU('FR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('DE', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('IT', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('ES', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('NL', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('GR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('CH', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  AU('US', 'visa_free', null, 90, 'Visa-free for tourism (ESTA required).', 'https://esta.cbp.dhs.gov/'),
  AU('CA', 'eta_required', 'eTA', 180, 'eTA required.', 'https://www.canada.ca/'),
  AU('NZ', 'visa_free', null, 90, 'Visa-free for Australian citizens.'),
  AU('JP', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('KR', 'visa_free', null, 90, 'Visa-free for tourism (K-ETA may apply).', 'https://www.k-eta.go.kr/'),
  AU('SG', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('MY', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AU('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AU('ID', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AU('AE', 'visa_free', null, 30, 'Visa on arrival. Free.'),
  AU('HK', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('MX', 'visa_free', null, 180, 'Visa-free for tourism.'),
  AU('BR', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('ZA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('MU', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('MA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  AU('GE', 'visa_free', null, 365, 'Visa-free for tourism.'),
  AU('QA', 'visa_free', null, 30, 'Visa-free for tourism.'),
  AU('TR', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://www.evisa.gov.tr/'),
  AU('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  AU('VN', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  AU('EG', 'evisa_available', 'e-Visa', 30, 'E-visa available.', 'https://www.visa2egypt.gov.eg/'),
  AU('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  AU('KE', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.go.ke/'),
  AU('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  AU('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  AU('NP', 'visa_on_arrival', 'VoA', 150, 'Visa on arrival.'),
  AU('CN', 'visa_required', 'Tourist', 30, 'Visa required.'),
  AU('RU', 'visa_required', 'Tourist', 30, 'Visa required.'),

  CA('US', 'visa_free', null, 180, 'Visa-free for tourism.'),
  CA('GB', 'visa_free', null, 180, 'Visa-free for tourism.'),
  CA('FR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('DE', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('IT', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('ES', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('NL', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('GR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('CH', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  CA('AU', 'eta_required', 'ETA', 90, 'ETA required.', 'https://immi.homeaffairs.gov.au/'),
  CA('NZ', 'eta_required', 'NZeTA', 90, 'NZeTA required.', 'https://www.immigration.govt.nz/'),
  CA('JP', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('KR', 'visa_free', null, 90, 'Visa-free for tourism (K-ETA may apply).', 'https://www.k-eta.go.kr/'),
  CA('SG', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('MY', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CA('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CA('ID', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CA('AE', 'visa_free', null, 30, 'Visa on arrival. Free.'),
  CA('HK', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('MX', 'visa_free', null, 180, 'Visa-free for tourism.'),
  CA('BR', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('ZA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('MU', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('MA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  CA('GE', 'visa_free', null, 365, 'Visa-free for tourism.'),
  CA('QA', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CA('TR', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://www.evisa.gov.tr/'),
  CA('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  CA('VN', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  CA('EG', 'evisa_available', 'e-Visa', 30, 'E-visa available.', 'https://www.visa2egypt.gov.eg/'),
  CA('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  CA('KE', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.go.ke/'),
  CA('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  CA('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  CA('NP', 'visa_on_arrival', 'VoA', 150, 'Visa on arrival.'),
  CA('CN', 'visa_required', 'Tourist', 30, 'Visa required.'),
  CA('RU', 'visa_required', 'Tourist', 30, 'Visa required.'),

  JP('US', 'visa_free', null, 90, 'Visa-free (ESTA required).', 'https://esta.cbp.dhs.gov/'),
  JP('CA', 'eta_required', 'eTA', 180, 'eTA required.', 'https://www.canada.ca/'),
  JP('GB', 'visa_free', null, 180, 'Visa-free for tourism.'),
  JP('FR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('DE', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('IT', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('ES', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('NL', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('GR', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('CH', 'visa_free', null, 90, 'Visa-free for tourism (Schengen).'),
  JP('AU', 'eta_required', 'ETA', 90, 'ETA required.', 'https://immi.homeaffairs.gov.au/'),
  JP('NZ', 'eta_required', 'NZeTA', 90, 'NZeTA required.', 'https://www.immigration.govt.nz/'),
  JP('KR', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('SG', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('MY', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  JP('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  JP('ID', 'visa_free', null, 30, 'Visa-free for tourism.'),
  JP('AE', 'visa_free', null, 30, 'Visa on arrival. Free.'),
  JP('HK', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('MX', 'visa_free', null, 180, 'Visa-free for tourism.'),
  JP('BR', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('ZA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('MU', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('MA', 'visa_free', null, 90, 'Visa-free for tourism.'),
  JP('GE', 'visa_free', null, 365, 'Visa-free for tourism.'),
  JP('QA', 'visa_free', null, 30, 'Visa-free for tourism.'),
  JP('TR', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://www.evisa.gov.tr/'),
  JP('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  JP('VN', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  JP('EG', 'evisa_available', 'e-Visa', 30, 'E-visa available.', 'https://www.visa2egypt.gov.eg/'),
  JP('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  JP('KE', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://evisa.go.ke/'),
  JP('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  JP('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  JP('NP', 'visa_on_arrival', 'VoA', 150, 'Visa on arrival.'),
  JP('CN', 'visa_required', 'Tourist', 30, 'Visa required.'),
  JP('RU', 'visa_required', 'Tourist', 30, 'Visa required.'),

  CN('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CN('MY', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CN('MV', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CN('AE', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CN('NP', 'visa_free', null, 150, 'Visa-free for tourism.'),
  CN('GE', 'visa_free', null, 30, 'Visa-free for tourism.'),
  CN('ID', 'visa_on_arrival', 'VoA', 30, 'Fee USD 35. Extendable once.', 'https://molina.imigrasi.go.id/'),
  CN('KH', 'visa_on_arrival', 'VoA', 30, 'Fee USD 30.'),
  CN('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  CN('SG', 'evisa_available', 'e-Visa', 30, 'Apply through authorized agents.', 'https://www.ica.gov.sg/'),
  CN('VN', 'evisa_available', 'e-Visa', 90, 'E-visa valid for 90 days.', 'https://evisa.xuatnhapcanh.gov.vn/'),
  CN('EG', 'evisa_available', 'e-Visa', 30, 'Apply online.', 'https://www.visa2egypt.gov.eg/'),
  CN('KE', 'evisa_available', 'e-Visa', 90, 'Apply at evisa.go.ke.', 'https://evisa.go.ke/'),
  CN('TR', 'evisa_available', 'e-Visa', 30, 'Apply online. Fee ~USD 50.', 'https://www.evisa.gov.tr/'),
  CN('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  CN('US', 'visa_required', 'B1/B2', 180, 'Interview required at embassy.'),
  CN('GB', 'visa_required', 'Standard Visitor', 180, 'Apply online. Biometrics required.', 'https://www.gov.uk/check-uk-visa'),
  CN('CA', 'visa_required', 'Visitor', 180, 'Apply online.'),
  CN('FR', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('DE', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('IT', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('ES', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('CH', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('NL', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('GR', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  CN('JP', 'visa_required', 'Tourist', 90, 'Apply at Japanese embassy.', 'https://www.mofa.go.jp/'),
  CN('KR', 'visa_required', 'Tourist', 90, 'Apply at Korean embassy.'),
  CN('AU', 'visa_required', 'Visitor 600', 90, 'Apply online.', 'https://immi.homeaffairs.gov.au/'),
  CN('NZ', 'visa_required', 'Visitor', 90, 'Apply online.', 'https://www.immigration.govt.nz/'),
  CN('RU', 'visa_required', 'Tourist', 30, 'Apply at Russian embassy.'),
  CN('ZA', 'visa_required', 'Visitor', 90, 'Apply at South African embassy.'),
  CN('BR', 'visa_required', 'Tourist', 90, 'Apply at Brazilian embassy.'),
  CN('MX', 'visa_required', 'Tourist', 180, 'Apply at Mexican embassy.'),
  CN('IN', 'visa_required', 'Tourist', 90, 'Apply at Indian embassy.', 'https://indianvisaonline.gov.in/'),
  CN('PH', 'visa_required', 'Tourist', 30, 'Apply at Philippine embassy.'),
  CN('QA', 'visa_required', 'Tourist', 30, 'Apply through Qatar portal.'),
  CN('MU', 'visa_free', null, 60, 'Visa-free for tourism.'),

  RU('TH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  RU('VN', 'visa_free', null, 15, 'Visa-free for short stays.'),
  RU('MY', 'visa_free', null, 30, 'Visa-free for tourism.'),
  RU('MU', 'visa_free', null, 60, 'Visa-free for tourism.'),
  RU('MV', 'visa_free', null, 90, 'Visa-free for tourism.'),
  RU('GE', 'visa_free', null, 365, 'Visa-free for tourism.'),
  RU('AE', 'visa_free', null, 90, 'Visa-free for tourism.'),
  RU('TR', 'visa_free', null, 60, 'Visa-free for tourism.'),
  RU('PH', 'visa_free', null, 30, 'Visa-free for tourism.'),
  RU('ID', 'visa_on_arrival', 'VoA', 30, 'Fee USD 35. Extendable once.', 'https://molina.imigrasi.go.id/'),
  RU('NP', 'visa_on_arrival', 'VoA', 150, 'Visa on arrival.'),
  RU('LK', 'eta_required', 'ETA', 30, 'ETA required.', 'https://eta.gov.lk/'),
  RU('SG', 'evisa_available', 'e-Visa', 30, 'Apply online.', 'https://www.ica.gov.sg/'),
  RU('IN', 'evisa_available', 'e-Visa', 180, 'E-visa available.', 'https://indianvisaonline.gov.in/'),
  RU('EG', 'evisa_available', 'e-Visa', 30, 'Apply online.', 'https://www.visa2egypt.gov.eg/'),
  RU('KE', 'evisa_available', 'e-Visa', 90, 'Apply at evisa.go.ke.', 'https://evisa.go.ke/'),
  RU('KH', 'evisa_available', 'e-Visa', 30, 'E-visa available.'),
  RU('SA', 'evisa_available', 'e-Visa', 90, 'E-visa available.', 'https://visa.visitsaudi.com/'),
  RU('US', 'visa_required', 'B1/B2', 180, 'Interview required at embassy.'),
  RU('GB', 'visa_required', 'Standard Visitor', 180, 'Apply online. Biometrics required.', 'https://www.gov.uk/check-uk-visa'),
  RU('CA', 'visa_required', 'Visitor', 180, 'Apply online.'),
  RU('FR', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('DE', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('IT', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('ES', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('CH', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('NL', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('GR', 'visa_required', 'Schengen', 90, 'Schengen visa via VFS.'),
  RU('JP', 'visa_required', 'Tourist', 90, 'Apply at Japanese embassy.', 'https://www.mofa.go.jp/'),
  RU('KR', 'visa_required', 'Tourist', 90, 'Apply at Korean embassy.'),
  RU('AU', 'visa_required', 'Visitor 600', 90, 'Apply online.', 'https://immi.homeaffairs.gov.au/'),
  RU('NZ', 'visa_required', 'Visitor', 90, 'Apply online.', 'https://www.immigration.govt.nz/'),
  RU('ZA', 'visa_required', 'Visitor', 90, 'Apply at South African embassy.'),
  RU('BR', 'visa_required', 'Tourist', 90, 'Apply at Brazilian embassy.'),
  RU('MX', 'visa_required', 'Tourist', 180, 'Apply at Mexican embassy.'),
  RU('CN', 'visa_required', 'Tourist', 30, 'Apply at Chinese embassy.'),
  RU('QA', 'visa_required', 'Tourist', 30, 'Apply through Qatar portal.'),
];

// ─── Visa Documents ───────────────────────────────────────────────────────────
// Documents required for visa applications by destination + visa type

interface DocEntry {
  destination_country: string;
  visa_type: string;
  document_type: string;
  is_required: boolean;
  description: string;
  notes: string | null;
  sort_order: number;
}

const D = (dest: string, vt: string, doc: string, req: boolean, desc: string, notes: string | null = null, order = 0): DocEntry =>
  ({ destination_country: dest, visa_type: vt, document_type: doc, is_required: req, description: desc, notes, sort_order: order });

const VISA_DOCUMENTS: DocEntry[] = [
  // ── Singapore (SG) — Tourist Visa ──
  D('SG', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity beyond intended stay', null, 1),
  D('SG', 'Tourist', 'Visa Application Form', true, 'Completed and signed Form 14A', 'Download from ICA website', 2),
  D('SG', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'White background, matte finish', 3),
  D('SG', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('SG', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation for entire stay', null, 5),
  D('SG', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3-6 months showing sufficient funds', 'Minimum SGD 2,000 per person recommended', 6),
  D('SG', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', 'Must be on company letterhead', 7),
  D('SG', 'Tourist', 'Travel Insurance', false, 'Travel insurance covering medical expenses and repatriation', 'Highly recommended', 8),
  D('SG', 'Tourist', 'Cover Letter', false, 'Cover letter explaining purpose of visit and itinerary', 'Helpful for first-time applicants', 9),

  // ── Thailand (TH) — Visa on Arrival / Tourist ──
  D('TH', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('TH', 'Tourist', 'Visa Application Form', true, 'Completed visa application form (TM.88 for VoA)', null, 2),
  D('TH', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('TH', 'Tourist', 'Flight Itinerary', true, 'Confirmed return flight ticket within 30 days', null, 4),
  D('TH', 'Tourist', 'Accommodation Proof', true, 'Hotel booking or proof of accommodation', null, 5),
  D('TH', 'Tourist', 'Bank Statements', true, 'Bank statement showing at least THB 20,000 (or equivalent)', null, 6),
  D('TH', 'Tourist', 'Travel Insurance', false, 'Travel insurance with COVID-19 coverage', 'Recommended for all travelers', 7),

  // ── Vietnam (VN) — e-Visa / Tourist ──
  D('VN', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('VN', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application at official portal', 'https://evisa.xuatnhapcanh.gov.vn/', 2),
  D('VN', 'Tourist', 'Passport Photos', true, 'Digital passport photo (4cm x 6cm)', 'Uploaded with application', 3),
  D('VN', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 4),
  D('VN', 'Tourist', 'Hotel Booking', true, 'Hotel reservation confirmation', null, 5),

  // ── UAE (AE) — Tourist ──
  D('AE', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('AE', 'Tourist', 'Visa Application Form', true, 'Completed visa application', null, 2),
  D('AE', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('AE', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('AE', 'Tourist', 'Hotel Booking', true, 'Hotel booking confirmation', null, 5),
  D('AE', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months', 'Minimum AED 5,000 balance recommended', 6),
  D('AE', 'Tourist', 'Travel Insurance', false, 'Travel insurance', 'Recommended', 7),

  // ── Japan (JP) — Tourist ──
  D('JP', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('JP', 'Tourist', 'Visa Application Form', true, 'Completed and signed visa application form', null, 2),
  D('JP', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs (45mm x 45mm)', null, 3),
  D('JP', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('JP', 'Tourist', 'Hotel Booking', true, 'Hotel reservation for entire stay', null, 5),
  D('JP', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3-6 months', null, 6),
  D('JP', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment and leave', 'Must be on company letterhead', 7),
  D('JP', 'Tourist', 'Itinerary', true, 'Detailed day-by-day travel itinerary', null, 8),

  // ── India (IN) — e-Visa / Tourist ──
  D('IN', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('IN', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application', 'https://indianvisaonline.gov.in/', 2),
  D('IN', 'Tourist', 'Passport Photos', true, 'Digital passport photo', 'Uploaded with application', 3),
  D('IN', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 4),
  D('IN', 'Tourist', 'Hotel Booking', false, 'Hotel booking confirmation', 'May be requested', 5),

  // ── Turkey (TR) — e-Visa ──
  D('TR', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('TR', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application', 'https://www.evisa.gov.tr/', 2),
  D('TR', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 3),
  D('TR', 'Tourist', 'Hotel Booking', false, 'Hotel booking confirmation', null, 4),

  // ── Schengen (FR) — Schengen Tourist ──
  D('FR', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('FR', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('FR', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('FR', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('FR', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('FR', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('FR', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('FR', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('FR', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('FR', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── UK (GB) — Standard Visitor ──
  D('GB', 'Standard Visitor', 'Passport', true, 'Valid passport', null, 1),
  D('GB', 'Standard Visitor', 'Visa Application Form', true, 'Completed online visa application (GWF number)', null, 2),
  D('GB', 'Standard Visitor', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('GB', 'Standard Visitor', 'Flight Itinerary', true, 'Confirmed flight booking', null, 4),
  D('GB', 'Standard Visitor', 'Accommodation Proof', true, 'Hotel bookings or invitation from host', null, 5),
  D('GB', 'Standard Visitor', 'Bank Statements', true, 'Bank statements from last 6 months showing sufficient funds', null, 6),
  D('GB', 'Standard Visitor', 'Employment Letter', true, 'Letter from employer confirming employment and leave approval', null, 7),
  D('GB', 'Standard Visitor', 'Travel Itinerary', true, 'Detailed itinerary of planned activities in UK', null, 8),

  // ── USA (US) — B1/B2 Tourist ──
  D('US', 'B1/B2', 'Passport', true, 'Valid passport with at least 6 months validity beyond intended stay', null, 1),
  D('US', 'B1/B2', 'DS-160 Confirmation', true, 'Confirmation page of DS-160 online application', 'Print barcode confirmation page', 2),
  D('US', 'B1/B2', 'Passport Photos', true, 'One recent passport-sized photograph (50mm x 50mm)', 'Uploaded with DS-160 application', 3),
  D('US', 'B1/B2', 'Visa Appointment Confirmation', true, 'Confirmed visa interview appointment at US embassy/consulate', null, 4),
  D('US', 'B1/B2', 'Fee Receipt', true, 'Visa application fee payment receipt (MRV fee)', 'USD 185 for most applicants', 5),
  D('US', 'B1/B2', 'Flight Itinerary', false, 'Round-trip flight booking', 'Not required but helpful', 6),
  D('US', 'B1/B2', 'Hotel Booking', false, 'Hotel reservation', 'Not required but helpful', 7),
  D('US', 'B1/B2', 'Bank Statements', true, 'Bank statements from last 6-12 months', null, 8),
  D('US', 'B1/B2', 'Employment Letter', true, 'Letter from employer confirming employment, position, salary, and approved leave', null, 9),
  D('US', 'B1/B2', 'Travel Itinerary', false, 'Detailed travel itinerary', 'Helpful for interview', 10),

  // ── Australia (AU) — Visitor 600 ──
  D('AU', 'Visitor 600', 'Passport', true, 'Valid passport', null, 1),
  D('AU', 'Visitor 600', 'Visa Application Form', true, 'Completed online visa application (ImmiAccount)', null, 2),
  D('AU', 'Visitor 600', 'Passport Photos', true, 'Recent passport-sized photograph', null, 3),
  D('AU', 'Visitor 600', 'Flight Itinerary', true, 'Confirmed flight booking', null, 4),
  D('AU', 'Visitor 600', 'Hotel Booking', true, 'Accommodation proof', null, 5),
  D('AU', 'Visitor 600', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('AU', 'Visitor 600', 'Employment Letter', true, 'Letter from employer confirming employment and leave', null, 7),
  D('AU', 'Visitor 600', 'Health Insurance', false, 'Overseas Visitor Health Cover (OVHC)', 'Recommended', 8),

  // ── Canada (CA) — Visitor / eTA ──
  D('CA', 'Visitor', 'Passport', true, 'Valid passport with at least 6 months validity beyond intended stay', null, 1),
  D('CA', 'Visitor', 'Visa Application Form', true, 'Completed online visa application (IRCC portal)', null, 2),
  D('CA', 'Visitor', 'Passport Photos', true, 'Two recent passport-sized photographs (50mm x 70mm)', null, 3),
  D('CA', 'Visitor', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('CA', 'Visitor', 'Hotel Booking', true, 'Hotel reservation for entire stay', null, 5),
  D('CA', 'Visitor', 'Bank Statements', true, 'Bank statements from last 3-6 months showing sufficient funds', null, 6),
  D('CA', 'Visitor', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 7),
  D('CA', 'Visitor', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 8),
  D('CA', 'Visitor', 'Travel History', false, 'Previous visas and travel history', 'Helpful for application', 9),
  D('CA', 'eTA', 'Passport', true, 'Valid passport', null, 1),
  D('CA', 'eTA', 'Online Application', true, 'Completed online eTA application', 'https://www.canada.ca/', 2),

  // ── Mexico (MX) — Tourist ──
  D('MX', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('MX', 'Tourist', 'Visa Application Form', true, 'Completed visa application form (if required)', null, 2),
  D('MX', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('MX', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('MX', 'Tourist', 'Hotel Booking', true, 'Hotel reservation for entire stay', null, 5),
  D('MX', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months', 'Minimum USD 500-1000 recommended', 6),
  D('MX', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment and leave', null, 7),
  D('MX', 'Tourist', 'Travel Insurance', false, 'Travel insurance covering medical expenses', 'Highly recommended', 8),

  // ── Brazil (BR) — Tourist ──
  D('BR', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('BR', 'Tourist', 'Visa Application Form', true, 'Completed online visa application form', null, 2),
  D('BR', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('BR', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('BR', 'Tourist', 'Hotel Booking', true, 'Hotel reservation for entire stay', null, 5),
  D('BR', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('BR', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment, salary, and leave', null, 7),
  D('BR', 'Tourist', 'Proof of Onward Travel', true, 'Confirmed onward or return ticket', null, 8),
  D('BR', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 9),

  // ── Germany (DE) — Schengen ──
  D('DE', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('DE', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('DE', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('DE', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('DE', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('DE', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('DE', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('DE', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('DE', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('DE', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── Italy (IT) — Schengen ──
  D('IT', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('IT', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('IT', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('IT', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('IT', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('IT', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('IT', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('IT', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('IT', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('IT', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── Spain (ES) — Schengen ──
  D('ES', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('ES', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('ES', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('ES', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('ES', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('ES', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('ES', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('ES', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('ES', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('ES', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── Switzerland (CH) — Schengen ──
  D('CH', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('CH', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('CH', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('CH', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('CH', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('CH', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('CH', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('CH', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('CH', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('CH', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── Netherlands (NL) — Schengen ──
  D('NL', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('NL', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('NL', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('NL', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('NL', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('NL', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('NL', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('NL', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('NL', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('NL', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── Greece (GR) — Schengen ──
  D('GR', 'Schengen', 'Passport', true, 'Valid passport with at least 3 months validity beyond departure from Schengen', null, 1),
  D('GR', 'Schengen', 'Visa Application Form', true, 'Completed and signed Schengen visa application form', null, 2),
  D('GR', 'Schengen', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', 'ICAO-compliant', 3),
  D('GR', 'Schengen', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('GR', 'Schengen', 'Hotel Booking', true, 'Hotel booking for entire stay in Schengen area', null, 5),
  D('GR', 'Schengen', 'Travel Insurance', true, 'Travel medical insurance minimum €30,000 coverage', 'Mandatory for Schengen visa', 6),
  D('GR', 'Schengen', 'Bank Statements', true, 'Bank statements from last 3-6 months', 'Minimum €50-100 per day of stay', 7),
  D('GR', 'Schengen', 'Employment Letter', true, 'Letter from employer confirming employment, position, and approved leave', null, 8),
  D('GR', 'Schengen', 'Travel Itinerary', true, 'Detailed day-by-day itinerary for Schengen stay', null, 9),
  D('GR', 'Schengen', 'Proof of Civil Status', true, 'Marriage certificate, birth certificate of children, etc.', null, 10),

  // ── Russia (RU) — Tourist ──
  D('RU', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity beyond intended stay', null, 1),
  D('RU', 'Tourist', 'Visa Application Form', true, 'Completed online visa application form', null, 2),
  D('RU', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', null, 3),
  D('RU', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('RU', 'Tourist', 'Hotel Booking', true, 'Hotel reservation confirmation (Voucher)', null, 5),
  D('RU', 'Tourist', 'Visa Invitation', true, 'Tourist voucher and invitation from Russian-accredited travel agency', 'Must be original', 6),
  D('RU', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 7),
  D('RU', 'Tourist', 'Travel Insurance', true, 'Travel medical insurance valid in Russia', 'Mandatory', 8),

  // ── New Zealand (NZ) — Visitor / NZeTA ──
  D('NZ', 'Visitor', 'Passport', true, 'Valid passport with at least 3 months validity beyond intended departure', null, 1),
  D('NZ', 'Visitor', 'Visa Application Form', true, 'Completed online visitor visa application', null, 2),
  D('NZ', 'Visitor', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('NZ', 'Visitor', 'Flight Itinerary', true, 'Confirmed onward or return flight booking', null, 4),
  D('NZ', 'Visitor', 'Hotel Booking', true, 'Accommodation proof for entire stay', null, 5),
  D('NZ', 'Visitor', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', 'Minimum NZD 1,000 per month', 6),
  D('NZ', 'Visitor', 'Employment Letter', true, 'Letter from employer confirming employment and leave', null, 7),
  D('NZ', 'Visitor', 'Travel Insurance', false, 'Travel medical insurance', 'Strongly recommended', 8),
  D('NZ', 'NZeTA', 'Passport', true, 'Valid passport', null, 1),
  D('NZ', 'NZeTA', 'Online Application', true, 'Completed NZeTA application via mobile app or website', 'https://www.immigration.govt.nz/', 2),

  // ── China (CN) — Tourist ──
  D('CN', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity beyond intended stay', null, 1),
  D('CN', 'Tourist', 'Visa Application Form', true, 'Completed online visa application form (COVA)', null, 2),
  D('CN', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs (33mm x 48mm)', 'White background, no glasses', 3),
  D('CN', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('CN', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation for entire stay', null, 5),
  D('CN', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3-6 months showing sufficient funds', null, 6),
  D('CN', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment, position, salary, and leave', null, 7),
  D('CN', 'Tourist', 'Travel Itinerary', true, 'Detailed day-by-day itinerary', null, 8),
  D('CN', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 9),

  // ── Hong Kong (HK) — Tourist ──
  D('HK', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('HK', 'Tourist', 'Visa Application Form', true, 'Completed visa application form (if required)', null, 2),
  D('HK', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('HK', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('HK', 'Tourist', 'Hotel Booking', true, 'Hotel reservation or accommodation proof', null, 5),
  D('HK', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('HK', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment and leave', null, 7),
  D('HK', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 8),

  // ── South Korea (KR) — Tourist ──
  D('KR', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('KR', 'Tourist', 'Visa Application Form', true, 'Completed visa application form', null, 2),
  D('KR', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs (35mm x 45mm)', null, 3),
  D('KR', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('KR', 'Tourist', 'Hotel Booking', true, 'Hotel reservation for entire stay', null, 5),
  D('KR', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3-6 months showing sufficient funds', null, 6),
  D('KR', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment, position, and leave', null, 7),
  D('KR', 'Tourist', 'Travel Itinerary', true, 'Detailed travel itinerary', null, 8),
  D('KR', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 9),
  D('KR', 'Tourist', 'K-ETA Approval', false, 'K-ETA travel authorization (for visa-free nationals)', 'https://www.k-eta.go.kr/', 10),

  // ── Malaysia (MY) — Tourist ──
  D('MY', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('MY', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 2),
  D('MY', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 3),
  D('MY', 'Tourist', 'Hotel Booking', true, 'Hotel reservation confirmation', null, 4),
  D('MY', 'Tourist', 'Bank Statements', false, 'Bank statements showing sufficient funds', 'May be requested', 5),
  D('MY', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 6),

  // ── Indonesia (ID) — Tourist / VoA ──
  D('ID', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('ID', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 2),
  D('ID', 'Tourist', 'Flight Itinerary', true, 'Confirmed onward or return flight booking within 30 days', null, 3),
  D('ID', 'Tourist', 'Hotel Booking', true, 'Hotel reservation for stay', null, 4),
  D('ID', 'Tourist', 'Proof of Onward Travel', true, 'Confirmed onward or return ticket', null, 5),
  D('ID', 'Tourist', 'Bank Statements', false, 'Bank statements showing sufficient funds', 'May be requested', 6),
  D('ID', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 7),

  // ── Philippines (PH) — Tourist ──
  D('PH', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('PH', 'Tourist', 'Visa Application Form', true, 'Completed visa application form', null, 2),
  D('PH', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('PH', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('PH', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation', null, 5),
  D('PH', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('PH', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment and approved leave', null, 7),
  D('PH', 'Tourist', 'Proof of Onward Travel', true, 'Confirmed onward or return ticket', null, 8),
  D('PH', 'Tourist', 'Travel Insurance', false, 'Travel insurance covering medical expenses', 'Recommended', 9),

  // ── Cambodia (KH) — Tourist / e-Visa / VoA ──
  D('KH', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('KH', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application', 'https://www.evisa.gov.kh/', 2),
  D('KH', 'Tourist', 'Passport Photos', true, 'Digital passport photo (4cm x 6cm)', 'Uploaded with e-visa application', 3),
  D('KH', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 4),
  D('KH', 'Tourist', 'Hotel Booking', true, 'Hotel reservation confirmation', null, 5),
  D('KH', 'Tourist', 'Bank Statements', false, 'Bank statements showing sufficient funds', 'May be requested', 6),
  D('KH', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 7),

  // ── Nepal (NP) — Tourist / VoA ──
  D('NP', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('NP', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 2),
  D('NP', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 3),
  D('NP', 'Tourist', 'Hotel Booking', true, 'Hotel reservation confirmation', null, 4),
  D('NP', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance covering trekking/high altitude activities', 'Highly recommended for trekkers', 5),

  // ── Sri Lanka (LK) — ETA / Tourist ──
  D('LK', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('LK', 'Tourist', 'ETA Application', true, 'Completed online ETA application', 'https://eta.gov.lk/', 2),
  D('LK', 'Tourist', 'Passport Photos', true, 'Digital passport photo', 'Uploaded with ETA application', 3),
  D('LK', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('LK', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation for entire stay', null, 5),
  D('LK', 'Tourist', 'Bank Statements', false, 'Bank statements showing sufficient funds', 'May be requested', 6),
  D('LK', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 7),

  // ── Maldives (MV) — Tourist ──
  D('MV', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('MV', 'Tourist', 'Flight Itinerary', true, 'Confirmed onward or return flight booking', null, 2),
  D('MV', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation for entire stay', null, 3),
  D('MV', 'Tourist', 'Proof of Sufficient Funds', true, 'Proof of sufficient funds for stay ($100+/day)', null, 4),
  D('MV', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 5),

  // ── Qatar (QA) — Tourist ──
  D('QA', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('QA', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 2),
  D('QA', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation', null, 3),
  D('QA', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 4),

  // ── Saudi Arabia (SA) — Tourist e-Visa ──
  D('SA', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('SA', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application', 'https://visa.visitsaudi.com/', 2),
  D('SA', 'Tourist', 'Passport Photos', true, 'Digital passport photo', 'Uploaded with application', 3),
  D('SA', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 4),
  D('SA', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation', null, 5),
  D('SA', 'Tourist', 'Travel Insurance', true, 'Travel medical insurance (included with e-Visa fee)', 'Mandatory', 6),

  // ── Egypt (EG) — Tourist / e-Visa ──
  D('EG', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('EG', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application', 'https://www.visa2egypt.gov.eg/', 2),
  D('EG', 'Tourist', 'Passport Photos', true, 'Digital passport photo', 'Uploaded with application', 3),
  D('EG', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('EG', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation for entire stay', null, 5),
  D('EG', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('EG', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 7),

  // ── Kenya (KE) — Tourist / e-Visa ──
  D('KE', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('KE', 'Tourist', 'e-Visa Application', true, 'Completed online e-visa application', 'https://evisa.go.ke/', 2),
  D('KE', 'Tourist', 'Passport Photos', true, 'Digital passport photo (passport-sized)', 'Uploaded with application', 3),
  D('KE', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('KE', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation', null, 5),
  D('KE', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('KE', 'Tourist', 'Yellow Fever Vaccination', true, 'Yellow fever vaccination certificate (if traveling from endemic country)', 'Required for certain itineraries', 7),
  D('KE', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 8),

  // ── Morocco (MA) — Tourist ──
  D('MA', 'Tourist', 'Passport', true, 'Valid passport with at least 3 months validity', null, 1),
  D('MA', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 2),
  D('MA', 'Tourist', 'Hotel Booking', true, 'Hotel reservation or accommodation proof', null, 3),
  D('MA', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 4),

  // ── South Africa (ZA) — Tourist ──
  D('ZA', 'Tourist', 'Passport', true, 'Valid passport with at least 2 blank pages and 30+ days validity', null, 1),
  D('ZA', 'Tourist', 'Visa Application Form', true, 'Completed visa application form (BI-84)', null, 2),
  D('ZA', 'Tourist', 'Passport Photos', true, 'Two recent passport-sized photographs', null, 3),
  D('ZA', 'Tourist', 'Flight Itinerary', true, 'Confirmed round-trip flight booking', null, 4),
  D('ZA', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation', null, 5),
  D('ZA', 'Tourist', 'Bank Statements', true, 'Bank statements from last 3 months showing sufficient funds', null, 6),
  D('ZA', 'Tourist', 'Employment Letter', true, 'Letter from employer confirming employment and approved leave', null, 7),
  D('ZA', 'Tourist', 'Yellow Fever Vaccination', true, 'Yellow fever vaccination certificate (if traveling from endemic region)', 'Required for certain itineraries', 8),
  D('ZA', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 9),

  // ── Mauritius (MU) — Tourist ──
  D('MU', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('MU', 'Tourist', 'Flight Itinerary', true, 'Confirmed onward or return flight booking', null, 2),
  D('MU', 'Tourist', 'Hotel Booking', true, 'Confirmed hotel reservation', null, 3),
  D('MU', 'Tourist', 'Bank Statements', false, 'Bank statements showing sufficient funds', 'May be requested', 4),
  D('MU', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 5),

  // ── Georgia (GE) — Tourist ──
  D('GE', 'Tourist', 'Passport', true, 'Valid passport with at least 6 months validity', null, 1),
  D('GE', 'Tourist', 'Flight Itinerary', true, 'Confirmed flight booking', null, 2),
  D('GE', 'Tourist', 'Hotel Booking', true, 'Hotel reservation confirmation', null, 3),
  D('GE', 'Tourist', 'Travel Insurance', false, 'Travel medical insurance', 'Recommended', 4),
];

// ─── Visa Fees ───────────────────────────────────────────────────────────────

interface FeeEntry {
  destination_country: string;
  visa_type: string;
  fee_amount: number | null;
  fee_currency: string;
  processing_time_days_min: number | null;
  processing_time_days_max: number | null;
  notes: string | null;
}

const F = (dest: string, vt: string, amt: number | null, cur: string, min: number | null, max: number | null, notes: string | null): FeeEntry =>
  ({ destination_country: dest, visa_type: vt, fee_amount: amt, fee_currency: cur, processing_time_days_min: min, processing_time_days_max: max, notes });

const VISA_FEES: FeeEntry[] = [
  // ── Singapore ──
  F('SG', 'Tourist', 30, 'SGD', 3, 5, 'Visa processing fee per application. Additional agent service fees may apply.'),

  // ── Thailand ──
  F('TH', 'Tourist', null, 'THB', null, null, 'Visa-free for many nationalities (30 days).' ),
  F('TH', 'VoA', 35, 'USD', 0, 0, 'Visa on Arrival fee. Cash only at border checkpoints.'),

  // ── Vietnam ──
  F('VN', 'Tourist', 25, 'USD', 3, 5, 'e-Visa fee for single entry (25 USD) or multiple entry (50 USD).'),
  F('VN', 'Tourist', 50, 'USD', 3, 5, 'Multiple entry e-Visa fee.'),

  // ── UAE ──
  F('AE', 'Tourist', 100, 'AED', 3, 5, 'Tourist visa fee varies by nationality and processing speed.'),

  // ── Japan ──
  F('JP', 'Tourist', 30, 'USD', 5, 10, 'Single-entry visa fee (equivalent in local currency). Free for certain nationalities.'),
  F('JP', 'Tourist', 60, 'USD', 5, 10, 'Multiple-entry visa fee (equivalent in local currency).'),

  // ── India ──
  F('IN', 'Tourist', 10, 'USD', 3, 5, 'e-Visa fee varies by nationality and duration (30 days: $10-25, 1 year: $40, 5 years: $80).'),
  F('IN', 'Tourist', 25, 'USD', 3, 5, 'e-Visa 30-day fee for most nationalities.'),

  // ── Turkey ──
  F('TR', 'Tourist', 50, 'USD', 0, 1, 'e-Visa fee. Instant processing upon payment.'),

  // ── France / Schengen ──
  F('FR', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── Germany / Schengen ──
  F('DE', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── Italy / Schengen ──
  F('IT', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── Spain / Schengen ──
  F('ES', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── Switzerland / Schengen ──
  F('CH', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── Netherlands / Schengen ──
  F('NL', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── Greece / Schengen ──
  F('GR', 'Schengen', 90, 'EUR', 15, 30, 'Standard Schengen visa fee (€90 for adults, €45 for children 6-12, free for under 6).'),

  // ── UK ──
  F('GB', 'Standard Visitor', 115, 'GBP', 15, 30, 'Standard Visitor visa fee (6 months). Higher fees for longer validity.'),
  F('GB', 'Standard Visitor', 400, 'GBP', 15, 30, '2-year Visitor visa fee.'),
  F('GB', 'Standard Visitor', 770, 'GBP', 15, 30, '5-year Visitor visa fee.'),
  F('GB', 'Standard Visitor', 964, 'GBP', 15, 30, '10-year Visitor visa fee.'),

  // ── USA ──
  F('US', 'B1/B2', 185, 'USD', 30, 90, 'Nonimmigrant visa application fee (MRV fee). Separate issuance fee may apply for certain nationalities.'),
  F('US', 'B1/B2', 205, 'USD', null, null, 'Visa issuance fee (reciprocity fee for certain nationalities).'),

  // ── Australia ──
  F('AU', 'Visitor 600', 195, 'AUD', 14, 30, 'Visitor visa (Subclass 600) application fee.'),

  // ── Indonesia ──
  F('ID', 'VoA', 35, 'USD', 0, 0, 'Visa on Arrival fee. Cash only at airport checkpoints. Extendable once (additional fee).'),
  F('ID', 'VoA', 35, 'USD', null, null, 'Extension fee for additional 30 days.'),

  // ── Egypt ──
  F('EG', 'Tourist', 25, 'USD', 3, 7, 'e-Visa fee for single entry.'),
  F('EG', 'Tourist', 60, 'USD', 3, 7, 'e-Visa fee for multiple entry.'),

  // ── Kenya ──
  F('KE', 'Tourist', 50, 'USD', 2, 7, 'e-Visa fee for single entry tourist visa.'),

  // ── Sri Lanka ──
  F('LK', 'ETA', 20, 'USD', 0, 2, 'ETA fee for SAARC countries. $35 for other nationalities.'),
  F('LK', 'ETA', 35, 'USD', 0, 2, 'ETA fee for non-SAARC nationalities.'),

  // ── Cambodia ──
  F('KH', 'Tourist', 30, 'USD', 3, 5, 'e-Visa fee for tourist visa (30 days).'),
  F('KH', 'VoA', 30, 'USD', 0, 0, 'Visa on Arrival fee.'),

  // ── Saudi Arabia ──
  F('SA', 'Tourist', 119, 'USD', 0, 1, 'e-Visa fee including medical insurance. Valid for 1 year multiple entry.'),

  // ── South Korea ──
  F('KR', 'Tourist', 40, 'USD', 5, 10, 'Single-entry visa fee.'),
  F('KR', 'Tourist', 60, 'USD', 5, 10, 'Multiple-entry visa fee.'),

  // ── China ──
  F('CN', 'Tourist', 140, 'USD', 4, 10, 'Standard tourist visa fee (varies by nationality under reciprocity).'),

  // ── Russia ──
  F('RU', 'Tourist', 50, 'USD', 7, 14, 'Tourist visa fee. Processing time 7-14 business days.'),

  // ── Mexico ──
  F('MX', 'Tourist', 48, 'USD', 7, 14, 'Tourist visa fee (if visa required). Many nationalities exempt.'),

  // ── Brazil ──
  F('BR', 'Tourist', 100, 'USD', 10, 20, 'Tourist visa fee (reciprocity-based, varies by nationality).'),

  // ── New Zealand ──
  F('NZ', 'Visitor', 130, 'NZD', 7, 21, 'Visitor visa application fee.'),
  F('NZ', 'NZeTA', 9, 'NZD', 0, 1, 'NZeTA fee via mobile app. $NZ 17 through website.'),

  // ── Canada ──
  F('CA', 'Visitor', 100, 'CAD', 14, 30, 'Visitor visa processing fee ($100 CAD). Biometrics fee: $85 CAD additional.'),
  F('CA', 'eTA', 7, 'CAD', 0, 1, 'eTA processing fee.'),

  // ── Nepal ──
  F('NP', 'Tourist', 30, 'USD', 0, 0, 'Visa on Arrival: $30 for 15 days, $50 for 30 days, $125 for 90 days.'),
  F('NP', 'VoA', 30, 'USD', 0, 0, '15-day visa on arrival fee.'),
  F('NP', 'VoA', 50, 'USD', 0, 0, '30-day visa on arrival fee.'),

  // ── Malaysia ──
  F('MY', 'Tourist', null, 'MYR', null, null, 'Visa-free for most nationalities (30-90 days).'),

  // ── Maldives ──
  F('MV', 'Tourist', null, 'USD', null, null, 'Free visa on arrival for all nationalities (30 days, extendable).'),

  // ── Philippines ──
  F('PH', 'Tourist', 40, 'USD', 7, 14, 'Tourist visa fee for nationalities requiring visa.'),

  // ── Morocco ──
  F('MA', 'Tourist', null, 'EUR', null, null, 'Visa-free for many nationalities (90 days).'),

  // ── Mauritius ──
  F('MU', 'Tourist', null, 'USD', null, null, 'Visa-free or visa on arrival for most nationalities.'),

  // ── Georgia ──
  F('GE', 'Tourist', null, 'GEL', null, null, 'Visa-free for most nationalities (365 days).'),

  // ── Qatar ──
  F('QA', 'Tourist', null, 'QAR', 0, 1, 'Visa-free for many nationalities. e-Visa available for others.'),

  // ── Hong Kong ──
  F('HK', 'Tourist', null, 'HKD', null, null, 'Visa-free for many nationalities (14-180 days depending on nationality).'),

  // ── South Africa ──
  F('ZA', 'Tourist', 36, 'USD', 7, 14, 'Tourist visa fee (varies by nationality under reciprocity).'),
];

export async function seedTravelVisaData(pool: Pool): Promise<void> {
  console.log('Seeding travel visa data...');

  // Insert countries
  for (const country of COUNTRIES) {
    await pool.query(
      `INSERT INTO travel_countries (iso_code, name, flag_emoji, region, subregion, is_popular_destination, requires_eta, eta_url, official_visa_url, currency, languages)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (iso_code) DO UPDATE SET
         name = EXCLUDED.name,
         flag_emoji = EXCLUDED.flag_emoji,
         region = EXCLUDED.region,
         subregion = EXCLUDED.subregion,
         is_popular_destination = EXCLUDED.is_popular_destination,
         requires_eta = EXCLUDED.requires_eta,
         eta_url = EXCLUDED.eta_url,
         official_visa_url = EXCLUDED.official_visa_url,
         currency = EXCLUDED.currency,
         languages = EXCLUDED.languages`,
      [
        country.iso_code,
        country.name,
        country.flag_emoji,
        country.region,
        country.subregion,
        country.is_popular_destination,
        country.requires_eta,
        country.eta_url,
        country.official_visa_url,
        country.currency,
        JSON.stringify(country.languages),
      ]
    );
  }

  // Insert visa requirements
  for (const req of VISA_REQUIREMENTS) {
    await pool.query(
      `INSERT INTO travel_visa_requirements (passport_country, destination_country, visa_status, visa_type, max_stay_days, notes, official_source_url, last_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (passport_country, destination_country) DO UPDATE SET
         visa_status = EXCLUDED.visa_status,
         visa_type = EXCLUDED.visa_type,
         max_stay_days = EXCLUDED.max_stay_days,
         notes = EXCLUDED.notes,
         official_source_url = EXCLUDED.official_source_url,
         last_verified = EXCLUDED.last_verified`,
      [req.passport_country, req.destination_country, req.visa_status, req.visa_type, req.max_stay_days, req.notes, req.official_source_url, req.last_verified]
    );
  }

  // Insert visa documents — delete existing for seeded destinations first for idempotency
  const seededDocDests = [...new Set(VISA_DOCUMENTS.map(d => d.destination_country))];
  await pool.query(`DELETE FROM visa_documents WHERE destination_country = ANY($1::text[])`, [seededDocDests]);
  for (const doc of VISA_DOCUMENTS) {
    await pool.query(
      `INSERT INTO visa_documents (destination_country, visa_type, document_type, is_required, description, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [doc.destination_country, doc.visa_type, doc.document_type, doc.is_required, doc.description, doc.notes, doc.sort_order]
    );
  }

  // Insert visa fees
  for (const fee of VISA_FEES) {
    await pool.query(
      `INSERT INTO visa_fees (destination_country, visa_type, fee_amount, fee_currency, processing_time_days_min, processing_time_days_max, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (destination_country, visa_type) DO UPDATE SET
         fee_amount = EXCLUDED.fee_amount,
         fee_currency = EXCLUDED.fee_currency,
         processing_time_days_min = EXCLUDED.processing_time_days_min,
         processing_time_days_max = EXCLUDED.processing_time_days_max,
         notes = EXCLUDED.notes`,
      [fee.destination_country, fee.visa_type, fee.fee_amount, fee.fee_currency, fee.processing_time_days_min, fee.processing_time_days_max, fee.notes]
    );
  }

  console.log(`Seeded ${COUNTRIES.length} countries, ${VISA_REQUIREMENTS.length} visa requirements, ${VISA_DOCUMENTS.length} visa documents, and ${VISA_FEES.length} visa fees`);
}
