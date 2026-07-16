import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { createTravelVisaService } from './travel-visa.service.js';

function createMockPool() {
  return { query: vi.fn() } as unknown as Pool;
}

describe('travel-visa service', () => {
  let pool: Pool;
  let service: ReturnType<typeof createTravelVisaService>;

  beforeEach(() => {
    pool = createMockPool();
    service = createTravelVisaService(pool);
  });

  it('returns all countries', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ iso_code: 'IN', name: 'India', is_popular_destination: true }],
    } as never);

    const countries = await service.getAllCountries();
    expect(countries).toHaveLength(1);
    expect(countries[0].iso_code).toBe('IN');
  });

  it('returns null for unknown country', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    expect(await service.getCountry('ZZ')).toBeNull();
  });

  it('checks visa requirement for a valid country pair', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{
          iso_code: 'IN',
          name: 'India',
          flag_emoji: '🇮🇳',
          region: 'Asia',
          subregion: 'Southern Asia',
          is_popular_destination: true,
          requires_eta: false,
          eta_url: null,
          official_visa_url: null,
          currency: 'INR',
          languages: ['hi'],
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          iso_code: 'TH',
          name: 'Thailand',
          flag_emoji: '🇹🇭',
          region: 'Asia',
          subregion: 'South-Eastern Asia',
          is_popular_destination: true,
          requires_eta: false,
          eta_url: null,
          official_visa_url: null,
          currency: 'THB',
          languages: ['th'],
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 'req-1',
          passport_country: 'IN',
          destination_country: 'TH',
          visa_status: 'visa_free',
          visa_type: 'Tourist',
          max_stay_days: 60,
          notes: null,
          official_source_url: null,
          last_verified: null,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await service.checkVisa({ passport_country: 'IN', destination_country: 'TH' });
    expect(result.visa_status).toBe('visa_free');
    expect(result.passport_country.iso_code).toBe('IN');
    expect(result.destination_country.iso_code).toBe('TH');
  });

  it('throws ValidationError for invalid country codes', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{
          iso_code: 'TH',
          name: 'Thailand',
          flag_emoji: null,
          region: null,
          subregion: null,
          is_popular_destination: true,
          requires_eta: false,
          eta_url: null,
          official_visa_url: null,
          currency: null,
          languages: null,
        }],
      } as never);

    await expect(
      service.checkVisa({ passport_country: 'ZZ', destination_country: 'TH' }),
    ).rejects.toThrow(/Invalid country code/i);
  });

  it('checks multiple destinations and builds summary counts', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{
          iso_code: 'IN',
          name: 'India',
          flag_emoji: null,
          region: null,
          subregion: null,
          is_popular_destination: true,
          requires_eta: false,
          eta_url: null,
          official_visa_url: null,
          currency: null,
          languages: null,
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { destination_country: 'TH', visa_status: 'visa_free', max_stay_days: 60 },
          { destination_country: 'VN', visa_status: 'evisa_available', max_stay_days: 30 },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          iso_code: 'TH',
          name: 'Thailand',
          flag_emoji: null,
          region: null,
          subregion: null,
          is_popular_destination: true,
          requires_eta: false,
          eta_url: null,
          official_visa_url: null,
          currency: null,
          languages: null,
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          iso_code: 'VN',
          name: 'Vietnam',
          flag_emoji: null,
          region: null,
          subregion: null,
          is_popular_destination: true,
          requires_eta: false,
          eta_url: null,
          official_visa_url: null,
          currency: null,
          languages: null,
        }],
      } as never);

    const result = await service.checkMultipleVisas({
      passport_country: 'IN',
      destinations: ['TH', 'VN'],
    });

    expect(result.results).toHaveLength(2);
    expect(result.summary.visa_free_count).toBe(1);
    expect(result.summary.evisa_available_count).toBe(1);
  });

  it('returns empty documents for unknown destination', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    expect(await service.getVisaDocuments('ZZ')).toEqual([]);
  });
});
