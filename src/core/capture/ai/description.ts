import { generateText } from 'ai';
import { localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import type { DOMContext } from '../dom/context';
import { serializeDOMContext } from '../dom/context';
import type { AIAPIFormat } from './models';
import { getLanguageSuffix, STEP_DESCRIPTION_PROMPT } from './prompts';
import { createModel } from './provider';

export interface AIConnectionSettings {
  baseURL?: string;
  apiFormat?: AIAPIFormat;
}

export async function getAIDescription(
  domContext: DOMContext,
  provider: string,
  model: string,
  apiKey: string,
  connection: AIConnectionSettings = {},
): Promise<string | null> {
  try {
    const settings = await localStorage.get(['aiLanguage']);
    const locale = (settings.aiLanguage as string) || 'en';
    const { text } = await generateText({
      model: createModel(provider, model, apiKey, connection),
      prompt:
        STEP_DESCRIPTION_PROMPT.replace('{{context}}', serializeDOMContext(domContext)) + getLanguageSuffix(locale),
      maxOutputTokens: 50,
    });
    return text.trim().replace(/^"|"$/g, '') || null;
  } catch (err) {
    logger.error('AI description failed, using fallback', err);
    return null;
  }
}
