import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAIConfig } from './ai-provider-config.js';

describe('getAIConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to DeepSeek when AI_PROVIDER is unset', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test');
    const config = getAIConfig();
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('deepseek-v4-flash');
    expect(config.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(config.provider).toBe('openai');
  });

  it('normalizes DeepSeek base URL without /v1 suffix', () => {
    vi.stubEnv('AI_PROVIDER', 'deepseek');
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test');
    vi.stubEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
    const config = getAIConfig();
    expect(config.baseUrl).toBe('https://api.deepseek.com/v1');
  });

  it('uses OpenAI when AI_PROVIDER=openai', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4o');
    const config = getAIConfig();
    expect(config.apiKey).toBe('sk-openai');
    expect(config.model).toBe('gpt-4o');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
  });
});
