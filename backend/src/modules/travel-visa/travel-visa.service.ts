import type { Pool } from 'pg';
import { ValidationError } from '../../infra/index.js';
import {
  type Country,
  type VisaRequirement,
  type VisaDocument,
  type VisaFee,
  type VisaCheckRequest,
  type VisaCheckResponse,
  type MultiVisaCheckRequest,
  type MultiVisaCheckResponse,
  type VisaStatus,
  VISA_STATUS_LABELS,
} from './travel-visa.types.js';

export interface TravelVisaService {
  getCountry(isoCode: string): Promise<Country | null>;
  getAllCountries(): Promise<Country[]>;
  getPopularDestinations(): Promise<Country[]>;
  checkVisa(request: VisaCheckRequest): Promise<VisaCheckResponse>;
  checkMultipleVisas(request: MultiVisaCheckRequest): Promise<MultiVisaCheckResponse>;
  getVisaDocuments(destinationCountry: string, visaType?: string): Promise<VisaDocument[]>;
  getVisaFees(destinationCountry: string, visaType?: string): Promise<VisaFee[]>;
}

export function createTravelVisaService(pool: Pool): TravelVisaService {
  return {
    async getCountry(isoCode: string): Promise<Country | null> {
      const result = await pool.query<Country>(
        `SELECT iso_code, name, flag_emoji, region, subregion, 
                is_popular_destination, requires_eta, eta_url, official_visa_url, 
                currency, languages
         FROM travel_countries 
         WHERE iso_code = $1`,
        [isoCode.toUpperCase()]
      );
      return result.rows[0] || null;
    },

    async getAllCountries(): Promise<Country[]> {
      const result = await pool.query<Country>(
        `SELECT iso_code, name, flag_emoji, region, subregion, 
                is_popular_destination, requires_eta, eta_url, official_visa_url, 
                currency, languages
         FROM travel_countries 
         ORDER BY name ASC`
      );
      return result.rows;
    },

    async getPopularDestinations(): Promise<Country[]> {
      const result = await pool.query<Country>(
        `SELECT iso_code, name, flag_emoji, region, subregion, 
                is_popular_destination, requires_eta, eta_url, official_visa_url, 
                currency, languages
         FROM travel_countries 
         WHERE is_popular_destination = TRUE
         ORDER BY name ASC`
      );
      return result.rows;
    },

    async checkVisa(request: VisaCheckRequest): Promise<VisaCheckResponse> {
      const { passport_country, destination_country } = request;
      
      // Get country info
      const [passportCountry, destinationCountry] = await Promise.all([
        this.getCountry(passport_country),
        this.getCountry(destination_country),
      ]);

      if (!passportCountry || !destinationCountry) {
        throw new ValidationError('Invalid country code');
      }

      // Get visa requirement
      const requirementResult = await pool.query<VisaRequirement>(
        `SELECT id, passport_country, destination_country, visa_status, visa_type,
                max_stay_days, notes, official_source_url, last_verified
         FROM travel_visa_requirements
         WHERE passport_country = $1 AND destination_country = $2`,
        [passport_country.toUpperCase(), destination_country.toUpperCase()]
      );

      const requirement = requirementResult.rows[0];
      const visaStatus: VisaStatus = requirement?.visa_status || 'unknown';

      // Get documents and fees
      const [documents, fees] = await Promise.all([
        this.getVisaDocuments(destination_country, requirement?.visa_type || undefined),
        this.getVisaFees(destination_country, requirement?.visa_type || undefined),
      ]);

      // Generate recommendations
      const recommendations = generateRecommendations(visaStatus, destinationCountry, requirement);

      return {
        passport_country: passportCountry,
        destination_country: destinationCountry,
        visa_status: visaStatus,
        visa_status_label: VISA_STATUS_LABELS[visaStatus],
        visa_type: requirement?.visa_type || null,
        max_stay_days: requirement?.max_stay_days || null,
        max_stay_label: formatMaxStay(requirement?.max_stay_days),
        notes: requirement?.notes || null,
        official_source_url: requirement?.official_source_url || destinationCountry.official_visa_url,
        last_verified: requirement?.last_verified || null,
        documents,
        fees,
        recommendations,
      };
    },

    async checkMultipleVisas(request: MultiVisaCheckRequest): Promise<MultiVisaCheckResponse> {
      const { passport_country, destinations } = request;
      
      const passportCountry = await this.getCountry(passport_country);
      if (!passportCountry) {
        throw new ValidationError('Invalid passport country code');
      }

      // Get all requirements in one query
      const result = await pool.query<{
        destination_country: string;
        visa_status: VisaStatus;
        max_stay_days: number | null;
      }>(
        `SELECT destination_country, visa_status, max_stay_days
         FROM travel_visa_requirements
         WHERE passport_country = $1 AND destination_country = ANY($2::text[])`,
        [passport_country.toUpperCase(), destinations.map(d => d.toUpperCase())]
      );

      // Create a map of results
      const resultMap = new Map(result.rows.map(r => [r.destination_country, r]));

      // Get all destination countries info
      const destinationCountries = await Promise.all(
        destinations.map(d => this.getCountry(d))
      );

      // Build results
      const results = destinations.map((dest, index) => {
        const country = destinationCountries[index];
        const req = resultMap.get(dest.toUpperCase());
        const status: VisaStatus = req?.visa_status || 'unknown';

        return {
          destination_country: country || {
            iso_code: dest.toUpperCase(),
            name: dest.toUpperCase(),
            flag_emoji: null,
            region: null,
            subregion: null,
            is_popular_destination: false,
            requires_eta: false,
            eta_url: null,
            official_visa_url: null,
            currency: null,
            languages: null,
          },
          visa_status: status,
          visa_status_label: VISA_STATUS_LABELS[status],
          max_stay_days: req?.max_stay_days || null,
          requires_action: ['visa_required', 'eta_required', 'evisa_available'].includes(status),
        };
      });

      // Build summary
      const summary = {
        visa_free_count: results.filter(r => r.visa_status === 'visa_free').length,
        visa_required_count: results.filter(r => r.visa_status === 'visa_required').length,
        eta_required_count: results.filter(r => r.visa_status === 'eta_required').length,
        evisa_available_count: results.filter(r => r.visa_status === 'evisa_available').length,
        visa_on_arrival_count: results.filter(r => r.visa_status === 'visa_on_arrival').length,
        action_needed: results
          .filter(r => r.requires_action)
          .map(r => r.destination_country.name || r.destination_country.iso_code),
      };

      return {
        passport_country: passportCountry,
        results,
        summary,
      };
    },

    async getVisaDocuments(destinationCountry: string, visaType?: string): Promise<VisaDocument[]> {
      const query = visaType
        ? `SELECT id, destination_country, visa_type, document_type, is_required, 
                  description, notes, sort_order
           FROM visa_documents
           WHERE destination_country = $1 AND visa_type = $2
           ORDER BY sort_order ASC, is_required DESC`
        : `SELECT id, destination_country, visa_type, document_type, is_required, 
                  description, notes, sort_order
           FROM visa_documents
           WHERE destination_country = $1
           ORDER BY sort_order ASC, is_required DESC`;
      
      const params = visaType
        ? [destinationCountry.toUpperCase(), visaType]
        : [destinationCountry.toUpperCase()];

      const result = await pool.query<VisaDocument>(query, params);
      return result.rows;
    },

    async getVisaFees(destinationCountry: string, visaType?: string): Promise<VisaFee[]> {
      const query = visaType
        ? `SELECT id, destination_country, visa_type, fee_amount, fee_currency,
                  processing_time_days_min, processing_time_days_max, notes
           FROM visa_fees
           WHERE destination_country = $1 AND visa_type = $2`
        : `SELECT id, destination_country, visa_type, fee_amount, fee_currency,
                  processing_time_days_min, processing_time_days_max, notes
           FROM visa_fees
           WHERE destination_country = $1`;
      
      const params = visaType
        ? [destinationCountry.toUpperCase(), visaType]
        : [destinationCountry.toUpperCase()];

      const result = await pool.query<VisaFee>(query, params);
      return result.rows;
    },
  };
}

// Helper functions
function formatMaxStay(days: number | null): string | null {
  if (!days) return null;
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }
  return `${days} days`;
}

function generateRecommendations(
  status: VisaStatus,
  destination: Country,
  requirement: VisaRequirement | undefined
): string[] {
  const recommendations: string[] = [];

  switch (status) {
    case 'visa_free':
      recommendations.push(`You can travel to ${destination.name} without a visa.`);
      if (requirement?.max_stay_days) {
        recommendations.push(`Maximum stay: ${formatMaxStay(requirement.max_stay_days)}.`);
      }
      recommendations.push('Ensure your passport is valid for at least 6 months beyond your travel dates.');
      break;

    case 'visa_on_arrival':
      recommendations.push(`You can obtain a visa upon arrival in ${destination.name}.`);
      if (requirement?.max_stay_days) {
        recommendations.push(`Maximum stay: ${formatMaxStay(requirement.max_stay_days)}.`);
      }
      recommendations.push('Check if you need to pay a visa fee in cash at the border.');
      recommendations.push('Have return ticket and accommodation proof ready.');
      break;

    case 'eta_required':
      recommendations.push(`You need an Electronic Travel Authorization (eTA) before traveling to ${destination.name}.`);
      if (destination.eta_url) {
        recommendations.push(`Apply at: ${destination.eta_url}`);
      }
      recommendations.push('eTA applications are usually processed within 24-72 hours.');
      break;

    case 'evisa_available':
      recommendations.push(`You can apply for an e-Visa online before traveling to ${destination.name}.`);
      if (destination.official_visa_url) {
        recommendations.push(`Apply at the official portal: ${destination.official_visa_url}`);
      }
      recommendations.push('Ensure you have digital copies of required documents.');
      break;

    case 'visa_required':
      recommendations.push(`You need to obtain a visa before traveling to ${destination.name}.`);
      recommendations.push('Visit the nearest embassy or consulate to apply.');
      if (destination.official_visa_url) {
        recommendations.push(`Check requirements at: ${destination.official_visa_url}`);
      }
      recommendations.push('Processing times vary; apply at least 2-4 weeks in advance.');
      break;

    case 'admission_refused':
      recommendations.push(`Entry to ${destination.name} is currently not permitted for your passport type.`);
      recommendations.push('Contact the nearest embassy for special circumstances.');
      break;

    case 'covid_ban':
      recommendations.push(`There may be COVID-related restrictions for travel to ${destination.name}.`);
      recommendations.push('Check current entry requirements before planning your trip.');
      break;

    default:
      recommendations.push('Visa information not available in our database.');
      recommendations.push('Please check with the destination country\'s embassy or official website.');
  }

  return recommendations;
}
