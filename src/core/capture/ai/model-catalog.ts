import type { AIModelOption } from './models';
import { normalizeBaseURL } from './provider';

const MODEL_REQUEST_TIMEOUT_MS = 10_000;

type ModelRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ModelRecord {
  return typeof value === 'object' && value !== null;
}

export function parseModelCatalog(payload: unknown): AIModelOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];

  const seen = new Set<string>();
  const models: AIModelOption[] = [];
  for (const item of payload.data) {
    const id =
      typeof item === 'string' ? item.trim() : isRecord(item) && typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({ id, label: id });
  }
  return models;
}

export async function fetchModelCatalog(baseURL?: string, apiKey?: string): Promise<AIModelOption[]> {
  const normalized = normalizeBaseURL(baseURL);
  if (!normalized) return [];

  const key = apiKey?.trim();
  const response = await fetch(`${normalized}/models`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Model catalog request failed with ${response.status}`);
  return parseModelCatalog(await response.json());
}
