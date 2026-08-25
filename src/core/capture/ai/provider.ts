import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { AIAPIFormat } from './models';

export interface AIConnectionOptions {
  baseURL?: string;
  apiFormat?: AIAPIFormat;
}

export function normalizeBaseURL(baseURL?: string): string | undefined {
  const trimmed = baseURL?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

export function createModel(
  provider: string,
  model: string,
  apiKey: string,
  options: AIConnectionOptions = {},
) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);

  if (provider === 'custom') {
    const baseURL = normalizeBaseURL(options.baseURL);
    if (!baseURL) throw new Error('Custom AI provider requires a base URL');

    if (options.apiFormat === 'anthropic-messages') {
      return createAnthropic({ apiKey, baseURL })(model);
    }

    const openai = createOpenAI({ apiKey, baseURL });
    if (options.apiFormat === 'openai-chat') return openai.chat(model);
    return openai(model);
  }

  return createOpenAI({ apiKey })(model);
}
