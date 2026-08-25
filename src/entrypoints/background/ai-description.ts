import { getAIDescription } from '@/core/capture/ai/description';
import { DEFAULT_CUSTOM_API_FORMAT, type AIAPIFormat } from '@/core/capture/ai/models';
import type { DOMContext } from '@/core/capture/dom/context';
import { localStorage } from '@/lib/browser-api';

export async function generateAiDescription(domContext: DOMContext): Promise<string | undefined> {
  const settings = await localStorage.get(['aiApiKey', 'aiProvider', 'aiModel', 'aiBaseURL', 'aiApiFormat']);
  if (!settings.aiApiKey) return undefined;

  const provider = (settings.aiProvider as string) || 'openai';
  const model = (settings.aiModel as string) || 'gpt-4o-mini';
  const description = await getAIDescription(domContext, provider, model, settings.aiApiKey as string, {
    baseURL: settings.aiBaseURL as string | undefined,
    apiFormat: ((settings.aiApiFormat as AIAPIFormat) || DEFAULT_CUSTOM_API_FORMAT),
  });
  return description || undefined;
}
