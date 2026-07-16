/**
 * AI Gateway Service — Content enrichment and recommendations.
 * Assistive only — not used for pricing, availability, or booking confirmation.
 * Streaming chat with tool calling lives in ai-stream.service.ts.
 */

import { createLogger, ValidationError, withRetryOrThrow, RETRY_EXTERNAL_API, isHttpRetryable } from '../../infra/index.js';
import { getAIConfig } from './ai-provider-config.js';
import type { AIProviderConfig } from './ai-provider-config.js';
import type { ChatMessage } from '../conversation/chat.types.js';

export type { ChatMessage } from '../conversation/chat.types.js';

const logger = createLogger('ai-gateway-service');

export interface ContentEnrichment {
  destination: string;
  description: string;
  highlights: string[];
  best_time_to_visit: string;
  image_urls: string[];
  local_tips: string[];
}

export interface UserPreferences {
  travel_style: string[];
  budget_range: { min: number; max: number; currency: string };
  interests: string[];
  past_destinations: string[];
}

export interface Recommendation {
  destination: string;
  reason: string;
  estimated_budget: number;
  trip_type: string[];
  image_url: string;
}

export interface AIGatewayService {
  enrichContent(destination: string): Promise<ContentEnrichment>;
  getRecommendations(preferences: UserPreferences): Promise<Recommendation[]>;
}


async function callAI(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  const config = getAIConfig();

  if (!config.apiKey) {
    logger.warn('AI provider API key not configured, returning mock response');
    throw new ValidationError(
      'AI provider is not configured. Set AI_PROVIDER and the matching API key (e.g. DEEPSEEK_API_KEY).',
    );
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user' as const, content: userMessage },
  ];

  return withRetryOrThrow(
    async () => {
      try {
        if (config.provider === 'anthropic') {
          return await callAnthropic(config, systemPrompt, messages.slice(1));
        }
        if (config.provider === 'openrouter') {
          return await callOpenRouter(config, messages, systemPrompt);
        }
        return await callOpenAI(config, messages);
      } catch (error) {
        logger.error('AI provider call failed', {
          provider: config.provider,
          error: (error as Error).message,
        });
        throw error;
      }
    },
    {
      ...RETRY_EXTERNAL_API,
      operationName: `ai-${config.provider}`,
      isRetryable: isHttpRetryable,
    },
  );
}

async function callOpenAI(
  config: AIProviderConfig,
  messages: { role: string; content: string }[],
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message?.content || '';
}

async function callAnthropic(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    content: { type: string; text: string }[];
  };

  return data.content[0]?.text || '';
}


async function callOpenRouter(
  config: AIProviderConfig,
  messages: { role: string; content: string }[],
  systemPrompt: string,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://voyr.com',
      'X-Title': 'Voyr',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message?.content || '';
}

const CONTENT_ENRICHMENT_PROMPT = `You are a content enrichment service for Voyr, an AI travel planning platform.
Provide rich content about the given destination.

Return a JSON object with these fields:
- destination: string
- description: string (2-3 paragraph description of the destination)
- highlights: string[] (top 5-8 things to do/see)
- best_time_to_visit: string (e.g., "November to March for dry season")
- image_urls: string[] (placeholder URLs like "https://images.voyr.com/destinations/{destination}/{n}.jpg")
- local_tips: string[] (3-5 local tips for travelers)

IMPORTANT: You are assistive only. This is informational content, not pricing or availability data.

Return ONLY valid JSON, no additional text.`;

const RECOMMENDATIONS_PROMPT = `You are a travel recommendation engine for Voyr, an AI travel planning platform.
Based on the user's preferences, suggest personalized travel destinations.

Return a JSON array of recommendation objects, each with:
- destination: string
- reason: string (why this destination matches their preferences)
- estimated_budget: number (rough estimate, not a binding price)
- trip_type: string[] (e.g., ["beach", "luxury"])
- image_url: string (placeholder URL like "https://images.voyr.com/destinations/{destination}/cover.jpg")

Provide 3-5 recommendations. IMPORTANT: You are assistive only. Estimated budgets are rough guides, not binding prices.

Return ONLY valid JSON, no additional text.`;


export function createAIGatewayService(): AIGatewayService {
  return {
    /**
     * Enrich content for a destination with descriptions, highlights, and images.
     */
    async enrichContent(destination: string): Promise<ContentEnrichment> {
      if (!destination || destination.trim().length === 0) {
        throw new ValidationError('Destination is required for content enrichment');
      }

      logger.info('Enriching content for destination', { destination });

      const response = await callAI(
        CONTENT_ENRICHMENT_PROMPT,
        `Provide rich content about: ${destination}`,
      );

      try {
        const parsed = JSON.parse(response) as ContentEnrichment;

        const enrichment: ContentEnrichment = {
          destination: parsed.destination || destination,
          description: parsed.description || '',
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
          best_time_to_visit: parsed.best_time_to_visit || '',
          image_urls: Array.isArray(parsed.image_urls) ? parsed.image_urls : [],
          local_tips: Array.isArray(parsed.local_tips) ? parsed.local_tips : [],
        };

        logger.info('Content enriched successfully', {
          destination: enrichment.destination,
          highlightCount: enrichment.highlights.length,
        });

        return enrichment;
      } catch (parseError) {
        logger.error('Failed to parse AI response as ContentEnrichment', {
          response: response.substring(0, 200),
          error: (parseError as Error).message,
        });
        throw new ValidationError('Failed to enrich content from AI response');
      }
    },

    /**
     * Get personalized travel recommendations based on user preferences.
     */
    async getRecommendations(preferences: UserPreferences): Promise<Recommendation[]> {
      if (!preferences) {
        throw new ValidationError('Preferences are required for recommendations');
      }

      logger.info('Getting recommendations', {
        interests: preferences.interests?.length || 0,
        travelStyle: preferences.travel_style?.length || 0,
      });

      const preferencesDescription = JSON.stringify(preferences);
      const response = await callAI(
        RECOMMENDATIONS_PROMPT,
        `Provide travel recommendations for these preferences: ${preferencesDescription}`,
      );

      try {
        const parsed = JSON.parse(response) as Recommendation[];

        const recommendations: Recommendation[] = (Array.isArray(parsed) ? parsed : []).map((rec) => ({
          destination: rec.destination || '',
          reason: rec.reason || '',
          estimated_budget: rec.estimated_budget || 0,
          trip_type: Array.isArray(rec.trip_type) ? rec.trip_type : [],
          image_url: rec.image_url || `https://images.voyr.com/destinations/${rec.destination}/cover.jpg`,
        }));

        logger.info('Recommendations generated', {
          count: recommendations.length,
        });

        return recommendations;
      } catch (parseError) {
        logger.error('Failed to parse AI response as Recommendations', {
          response: response.substring(0, 200),
          error: (parseError as Error).message,
        });
        throw new ValidationError('Failed to generate recommendations from AI response');
      }
    },
  };
}
