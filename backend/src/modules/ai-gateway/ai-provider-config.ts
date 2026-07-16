/**
 * Shared AI provider configuration from environment variables.
 *
 * DeepSeek uses the OpenAI-compatible chat/completions API at /v1.
 */

export type AIWireProvider = 'openai' | 'anthropic' | 'openrouter';

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Which HTTP client shape to use (DeepSeek maps to openai-compatible). */
  provider: AIWireProvider;
}

function normalizeOpenAICompatibleBaseUrl(url: string): string {
  const trimmed = url.replace(/\/$/, '');
  if (trimmed.endsWith('/v1')) {
    return trimmed;
  }
  if (trimmed === 'https://api.deepseek.com') {
    return `${trimmed}/v1`;
  }
  return trimmed;
}

export function getAIConfig(): AIProviderConfig {
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();

  if (provider === 'anthropic') {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      provider: 'anthropic',
    };
  }

  if (provider === 'openrouter') {
    return {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'inclusionai/ring-2.6-1t:free',
      baseUrl: 'https://openrouter.ai/api/v1',
      provider: 'openrouter',
    };
  }

  if (provider === 'gemini') {
    return {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      provider: 'openai',
    };
  }

  if (provider === 'deepseek') {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      baseUrl: normalizeOpenAICompatibleBaseUrl(
        process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      ),
      provider: 'openai',
    };
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    baseUrl: normalizeOpenAICompatibleBaseUrl(
      process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    ),
    provider: 'openai',
  };
}
