import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateApiKey } from '../validate';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('validateApiKey', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('accepts a key the provider returns 200 for', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: true });
  });

  it('reports a 401 as rejected, not as a network problem', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    expect(await validateApiKey('openai', 'sk-bad')).toEqual({ valid: false, reason: 'rejected' });
  });

  it('reports a 403 as rejected', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    expect(await validateApiKey('anthropic', 'bad')).toEqual({ valid: false, reason: 'rejected' });
  });

  it('does not blame the key when the request never completes', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: false, reason: 'network' });
  });

  it('does not blame the key on a provider outage', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: false, reason: 'network' });
  });

  it('sends the anthropic browser-access header so the request is not blocked by CORS', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await validateApiKey('anthropic', 'ant-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/models');
    expect(init.headers['x-api-key']).toBe('ant-key');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('sends a bearer token for openai', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await validateApiKey('openai', 'sk-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.headers.Authorization).toBe('Bearer sk-key');
  });

  it('checks a groq key against groq, not openai', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    expect(await validateApiKey('groq', 'gsk-key')).toEqual({ valid: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/models');
    expect(init.headers.Authorization).toBe('Bearer gsk-key');
  });

  it('gives up rather than spinning forever when a host never answers', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await validateApiKey('openai', 'sk-key');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('never sends a key to an unknown provider, and does not call it rejected', async () => {
    expect(await validateApiKey('mystery', 'secret')).toEqual({ valid: false, reason: 'network' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates a custom OpenAI-chat key with an authenticated minimal inference request', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    expect(
      await validateApiKey('custom', 'oc-good', 'https://opencode.ai/zen/go/v1', 'openai-chat', 'kimi-k2.5'),
    ).toEqual({ valid: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer oc-good');
    expect(JSON.parse(init.body)).toEqual({
      model: 'kimi-k2.5',
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      max_tokens: 1,
    });
  });

  it('does not accept a custom key when the inference request rejects it', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      validateApiKey('custom', 'oc-bad', 'https://opencode.ai/zen/go/v1', 'openai-chat', 'kimi-k2.5'),
    ).resolves.toEqual({ valid: false, reason: 'rejected' });
  });

  it('never treats a public models response as custom key validation', async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init.method === 'GET' ? { ok: true, status: 200 } : { ok: false, status: 401 },
    );

    await expect(
      validateApiKey('custom', 'oc-bad', 'https://opencode.ai/zen/go/v1', 'openai-chat', 'kimi-k2.5'),
    ).resolves.toEqual({ valid: false, reason: 'rejected' });
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('uses the selected format endpoint for Responses and Anthropic Messages', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await validateApiKey('custom', 'key', 'https://provider.test/v1', 'openai-responses', 'model-a');
    expect(fetchMock.mock.calls[0][0]).toBe('https://provider.test/v1/responses');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: 'model-a',
      input: 'Reply with OK.',
      max_output_tokens: 1,
    });

    await validateApiKey('custom', 'key', 'https://provider.test/v1', 'anthropic-messages', 'model-b');
    expect(fetchMock.mock.calls[1][0]).toBe('https://provider.test/v1/messages');
    expect(fetchMock.mock.calls[1][1].headers['x-api-key']).toBe('key');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(1);
  });
});
