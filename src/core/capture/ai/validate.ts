import type { AIAPIFormat } from './models';
import { normalizeBaseURL } from './provider';
import { logger } from '@/lib/logger';

export type KeyValidation = { valid: true } | { valid: false; reason: 'rejected' | 'network' };

const REQUEST_TIMEOUT_MS = 10_000;

const ENDPOINTS: Record<string, { url: string; headers: (key: string) => Record<string, string> }> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

function customEndpoint(
  apiKey: string,
  baseURL?: string,
  apiFormat?: AIAPIFormat,
): { url: string; headers: Record<string, string> } | null {
  const normalized = normalizeBaseURL(baseURL);
  if (!normalized) return null;

  if (apiFormat === 'anthropic-messages') {
    return {
      url: `${normalized}/models`,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    };
  }

  return {
    url: `${normalized}/models`,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseURL?: string,
  apiFormat?: AIAPIFormat,
): Promise<KeyValidation> {
  const custom = provider === 'custom' ? customEndpoint(apiKey, baseURL, apiFormat) : null;
  const endpoint = provider === 'custom' ? custom : ENDPOINTS[provider];
  if (!endpoint) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  try {
    const res = await fetch(endpoint.url, {
      headers: 'headers' in endpoint ? endpoint.headers : endpoint.headers(apiKey),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: 'rejected' };
    return { valid: false, reason: 'network' };
  } catch (err) {
    logger.error('API key validation request failed', err);
    return { valid: false, reason: 'network' };
  }
}
