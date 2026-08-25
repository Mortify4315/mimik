import { logger } from '@/lib/logger';
import type { AIAPIFormat } from './models';
import { normalizeBaseURL } from './provider';

export type KeyValidation = { valid: true } | { valid: false; reason: 'rejected' | 'network' };

type ValidationRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

const ENDPOINTS: Record<
  string,
  { url: string; method: 'GET' | 'POST'; headers: (key: string) => Record<string, string> }
> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    method: 'GET',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    method: 'GET',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

function customRequest(
  apiKey: string,
  baseURL: string | undefined,
  apiFormat: AIAPIFormat | undefined,
  model: string | undefined,
): ValidationRequest | null {
  const normalized = normalizeBaseURL(baseURL);
  const selectedModel = model?.trim();
  if (!normalized || !selectedModel) return null;

  if (apiFormat === 'anthropic-messages') {
    return {
      url: `${normalized}/messages`,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
      }),
    };
  }

  const responses = apiFormat === 'openai-responses';
  return {
    url: `${normalized}/${responses ? 'responses' : 'chat/completions'}`,
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(
      responses
        ? { model: selectedModel, input: 'Reply with OK.', max_output_tokens: 1 }
        : { model: selectedModel, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 8 },
    ),
  };
}

function validationRequest(
  provider: string,
  apiKey: string,
  baseURL?: string,
  apiFormat?: AIAPIFormat,
  model?: string,
): ValidationRequest | null {
  if (provider === 'custom') return customRequest(apiKey, baseURL, apiFormat, model);
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) return null;
  return { url: endpoint.url, method: endpoint.method, headers: endpoint.headers(apiKey) };
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseURL?: string,
  apiFormat?: AIAPIFormat,
  model?: string,
): Promise<KeyValidation> {
  const request = validationRequest(provider, apiKey, baseURL, apiFormat, model);
  if (!request) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  try {
    const res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
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
