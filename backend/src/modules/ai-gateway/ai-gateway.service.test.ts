/**
 * Unit tests for the AI Gateway Service.
 *
 * Tests:
 * - Content enrichment returns valid ContentEnrichment structure
 * - Recommendations return valid Recommendation array
 * - AI is not called for pricing or booking operations (Req 11.3, 11.4)
 * - AI provider configuration (OpenAI/Anthropic)
 *
 * Strategy: Mock the global `fetch` to intercept AI provider calls and return
 * controlled JSON responses. This isolates the service logic from external APIs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAIGatewayService } from './ai-gateway.service.js';
import type {
  AIGatewayService,
  ContentEnrichment,
  Recommendation,
  UserPreferences,
} from './ai-gateway.service.js';


vi.mock('../../infra/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  withRetryOrThrow: async (fn: () => Promise<unknown>) => fn(),
  RETRY_EXTERNAL_API: { maxRetries: 3, baseDelayMs: 100, operationName: 'test' },
  isHttpRetryable: () => false,
}));


const MOCK_OPENAI_KEY = 'sk-test-key-for-unit-tests';

function mockOpenAIResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function buildContentEnrichmentResponse(overrides: Partial<ContentEnrichment> = {}): ContentEnrichment {
  return {
    destination: 'Bali',
    description: 'Bali is a tropical paradise known for its temples and beaches.',
    highlights: ['Ubud Rice Terraces', 'Tanah Lot Temple', 'Kuta Beach'],
    best_time_to_visit: 'April to October for dry season',
    image_urls: ['https://images.voyr.com/destinations/Bali/1.jpg'],
    local_tips: ['Bargain at local markets', 'Rent a scooter for easy transport'],
    ...overrides,
  };
}

function buildRecommendationsResponse(): Recommendation[] {
  return [
    {
      destination: 'Bali',
      reason: 'Perfect for beach lovers and cultural exploration.',
      estimated_budget: 3000,
      trip_type: ['beach', 'cultural'],
      image_url: 'https://images.voyr.com/destinations/Bali/cover.jpg',
    },
    {
      destination: 'Maldives',
      reason: 'Ideal for luxury relaxation and water activities.',
      estimated_budget: 5000,
      trip_type: ['luxury', 'beach'],
      image_url: 'https://images.voyr.com/destinations/Maldives/cover.jpg',
    },
  ];
}


describe('AI Gateway Service — Unit Tests', () => {
  let service: AIGatewayService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', MOCK_OPENAI_KEY);
    vi.stubEnv('OPENAI_MODEL', 'gpt-4o');
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');

    fetchSpy = vi.spyOn(globalThis, 'fetch');
    service = createAIGatewayService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });


  describe('enrichContent', () => {
    it('should return ContentEnrichment with all required fields', async () => {
      const mockEnrichment = buildContentEnrichmentResponse();
      fetchSpy.mockResolvedValueOnce(mockOpenAIResponse(mockEnrichment));

      const result = await service.enrichContent('Bali');

      expect(result.destination).toBe('Bali');
      expect(typeof result.description).toBe('string');
      expect(Array.isArray(result.highlights)).toBe(true);
      expect(typeof result.best_time_to_visit).toBe('string');
      expect(Array.isArray(result.image_urls)).toBe(true);
      expect(Array.isArray(result.local_tips)).toBe(true);
    });

    it('should throw ValidationError for empty destination', async () => {
      await expect(service.enrichContent(''))
        .rejects.toThrow(/required/i);
    });

    it('should handle incomplete AI response with defaults', async () => {
      const partial = { destination: 'Bali' };
      fetchSpy.mockResolvedValueOnce(mockOpenAIResponse(partial));

      const result = await service.enrichContent('Bali');

      expect(result.destination).toBe('Bali');
      expect(result.description).toBe('');
      expect(result.highlights).toEqual([]);
      expect(result.image_urls).toEqual([]);
      expect(result.local_tips).toEqual([]);
    });
  });


  describe('getRecommendations', () => {
    it('should return an array of Recommendation objects', async () => {
      const mockRecs = buildRecommendationsResponse();
      fetchSpy.mockResolvedValueOnce(mockOpenAIResponse(mockRecs));

      const preferences: UserPreferences = {
        travel_style: ['beach', 'luxury'],
        budget_range: { min: 2000, max: 5000, currency: 'USD' },
        interests: ['snorkeling', 'spa'],
        past_destinations: ['Thailand'],
      };

      const result = await service.getRecommendations(preferences);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const rec = result[0];
      expect(rec).toHaveProperty('destination');
      expect(rec).toHaveProperty('reason');
      expect(rec).toHaveProperty('estimated_budget');
      expect(rec).toHaveProperty('trip_type');
      expect(rec).toHaveProperty('image_url');
    });

    it('should throw ValidationError when preferences are not provided', async () => {
      await expect(service.getRecommendations(null as unknown as UserPreferences))
        .rejects.toThrow(/required/i);
    });
  });


  describe('AI is assistive only — no pricing, availability, or booking', () => {
    it('should NOT expose any method for pricing decisions', () => {
      const serviceKeys = Object.keys(service);

      // The service should only have these two assistive methods
      expect(serviceKeys).toContain('enrichContent');
      expect(serviceKeys).toContain('getRecommendations');

      // Should NOT have methods for pricing, availability, or booking
      const forbiddenPatterns = [
        /price/i, /pricing/i, /availability/i, /booking/i,
        /confirm/i, /payment/i, /checkout/i, /reserve/i,
      ];

      for (const key of serviceKeys) {
        for (const pattern of forbiddenPatterns) {
          expect(key).not.toMatch(pattern);
        }
      }
    });

    it('should only have exactly 2 methods: enrichContent, getRecommendations', () => {
      const serviceKeys = Object.keys(service);
      expect(serviceKeys).toHaveLength(2);
      expect(new Set(serviceKeys)).toEqual(
        new Set(['enrichContent', 'getRecommendations']),
      );
    });

    it('should include assistive-only instruction in content enrichment prompt', async () => {
      const mockEnrichment = buildContentEnrichmentResponse();
      fetchSpy.mockResolvedValueOnce(mockOpenAIResponse(mockEnrichment));

      await service.enrichContent('Bali');

      const requestBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const systemMessage = requestBody.messages.find((m: { role: string }) => m.role === 'system');

      expect(systemMessage.content).toMatch(/assistive only/i);
      expect(systemMessage.content).toMatch(/not pricing or availability/i);
    });

    it('should include assistive-only instruction in recommendations prompt', async () => {
      const mockRecs = buildRecommendationsResponse();
      fetchSpy.mockResolvedValueOnce(mockOpenAIResponse(mockRecs));

      const preferences: UserPreferences = {
        travel_style: ['adventure'],
        budget_range: { min: 1000, max: 3000, currency: 'USD' },
        interests: ['hiking'],
        past_destinations: [],
      };

      await service.getRecommendations(preferences);

      const requestBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const systemMessage = requestBody.messages.find((m: { role: string }) => m.role === 'system');

      expect(systemMessage.content).toMatch(/assistive only/i);
      expect(systemMessage.content).toMatch(/not binding prices/i);
    });
  });


  describe('AI provider configuration', () => {
    it('should throw ValidationError when API key is not configured', async () => {
      vi.stubEnv('OPENAI_API_KEY', '');

      const unconfiguredService = createAIGatewayService();

      await expect(unconfiguredService.enrichContent('Bali'))
        .rejects.toThrow(/not configured/i);
    });

    it('should call the OpenAI endpoint when provider is openai', async () => {
      const mockEnrichment = buildContentEnrichmentResponse();
      fetchSpy.mockResolvedValueOnce(mockOpenAIResponse(mockEnrichment));

      await service.enrichContent('Bali');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('openai.com');
      expect(url).toContain('/chat/completions');
    });

    it('should call the Anthropic endpoint when provider is anthropic', async () => {
      vi.stubEnv('AI_PROVIDER', 'anthropic');
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');

      const anthropicService = createAIGatewayService();
      const mockEnrichment = buildContentEnrichmentResponse();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: JSON.stringify(mockEnrichment) }],
          }),
          { status: 200 },
        ),
      );

      await anthropicService.enrichContent('Bali');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('anthropic.com');
      expect(url).toContain('/messages');
    });
  });
});
