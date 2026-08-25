import { logger } from '@/lib/logger';
import type { AIAPIFormat } from './models';
import { normalizeBaseURL } from './provider';

export type KeyValidation = { valid: true } | { valid: false; reason: 'rejected' | 'network' };

type ValidationRequest = { url: string; headers: Record<string, string> };

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

function customRequest(apiKey: string, baseURL?: string, apiFormat?: AIAPIFormat): ValidationRequest | null {
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

function validationRequest(
  provider: string,
  apiKey: string,
  baseURL?: string,
  apiFormat?: AIAPIFormat,
): ValidationRequest | null {
  if (provider === 'custom') return customRequest(apiKey, baseURL, apiFormat);
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) return null;
  return { url: endpoint.url, headers: endpoint.headers(apiKey) };
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseURL?: string,
  apiFormat?: AIAPIFormat,
): Promise<KeyValidation> {
  const request = validationRequest(provider, apiKey, baseURL, apiFormat);
  if (!request) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  try {
    const res = await fetch(request.url, {
      headers: request.headers,
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
