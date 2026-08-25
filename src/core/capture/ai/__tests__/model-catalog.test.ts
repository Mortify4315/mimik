import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchModelCatalog, parseModelCatalog } from '../model-catalog';

describe('parseModelCatalog', () => {
  it('normalizes OpenAI-compatible model responses into unique model options', () => {
    expect(
      parseModelCatalog({
        data: [{ id: 'glm-5.3' }, { id: 'kimi-k3', owned_by: 'opencode' }, { id: 'glm-5.3' }, { id: '' }, { id: 42 }],
      }),
    ).toEqual([
      { id: 'glm-5.3', label: 'glm-5.3' },
      { id: 'kimi-k3', label: 'kimi-k3' },
    ]);
  });

  it('returns an empty list for an invalid catalog payload', () => {
    expect(parseModelCatalog({ object: 'list', data: null })).toEqual([]);
    expect(parseModelCatalog(null)).toEqual([]);
  });
});

describe('fetchModelCatalog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the models endpoint and includes the optional API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'kimi-k3' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchModelCatalog('https://opencode.ai/zen/go/v1', 'test-key')).resolves.toEqual([
      { id: 'kimi-k3', label: 'kimi-k3' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://opencode.ai/zen/go/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-key' },
      }),
    );
  });

  it('does not fetch when the endpoint is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchModelCatalog('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
