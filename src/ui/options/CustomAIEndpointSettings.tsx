import { useEffect, useState } from 'react';
import {
  AI_API_FORMATS,
  type AIAPIFormat,
  DEFAULT_CUSTOM_API_FORMAT,
  DEFAULT_CUSTOM_BASE_URL,
} from '@/core/capture/ai/models';
import { localStorage } from '@/lib/browser-api';
import { Input } from '@/ui/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/ui/select';

const PRESETS = [
  { label: 'OpenCode Go (chat)', baseURL: 'https://opencode.ai/zen/go/v1', apiFormat: 'openai-chat' as AIAPIFormat },
  {
    label: 'OpenCode Go (responses)',
    baseURL: 'https://opencode.ai/zen/go/v1',
    apiFormat: 'openai-responses' as AIAPIFormat,
  },
  {
    label: 'OpenCode Go (Anthropic)',
    baseURL: 'https://opencode.ai/zen/go/v1',
    apiFormat: 'anthropic-messages' as AIAPIFormat,
  },
];

export default function CustomAIEndpointSettings() {
  const [baseURL, setBaseURL] = useState('');
  const [apiFormat, setApiFormat] = useState<AIAPIFormat>(DEFAULT_CUSTOM_API_FORMAT);
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    localStorage.get(['aiBaseURL', 'aiApiFormat', 'aiModel', 'aiApiKey', 'aiProvider']).then((settings) => {
      setBaseURL((settings.aiBaseURL as string) || (settings.aiProvider === 'custom' ? DEFAULT_CUSTOM_BASE_URL : ''));
      if (settings.aiApiFormat) setApiFormat(settings.aiApiFormat as AIAPIFormat);
      if (settings.aiModel) setModel(settings.aiModel as string);
      if (settings.aiApiKey) setApiKey(settings.aiApiKey as string);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      localStorage
        .set({
          aiProvider: 'custom',
          aiBaseURL: baseURL.trim(),
          aiApiFormat: apiFormat,
          aiModel: model.trim(),
          aiApiKey: apiKey.trim(),
        })
        .then(() => {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1200);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [baseURL, apiFormat, model, apiKey, loaded]);

  return (
    <div className="border-t border-border px-3 py-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-foreground">OpenCode Go / compatible endpoint</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Configure an OpenAI- or Anthropic-compatible BYOK endpoint.
          </p>
        </div>
        <span className={`text-[10px] text-muted-foreground transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
          Saved
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setBaseURL(preset.baseURL);
              setApiFormat(preset.apiFormat);
            }}
            className="px-2 py-1 rounded-md border border-border text-[10px] text-muted-foreground hover:border-accent hover:text-foreground transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">Base URL</label>
        <Input
          value={baseURL}
          onChange={(event) => setBaseURL(event.target.value)}
          placeholder="https://provider.example/v1"
          className="h-8 text-[12px] rounded-lg border-border"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">API format</label>
        <Select value={apiFormat} onValueChange={(value) => setApiFormat(value as AIAPIFormat)}>
          <SelectTrigger className="w-full rounded-lg px-3 py-2 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_API_FORMATS.map((format) => (
              <SelectItem key={format.id} value={format.id}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">Model ID</label>
        <Input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="e.g. kimi-k3 or cc/claude-sonnet-4"
          className="h-8 text-[12px] rounded-lg border-border"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-foreground mb-1">API key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Provider API key"
          className="h-8 text-[12px] rounded-lg border-border"
        />
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Saving this panel switches AI descriptions to OpenCode Go. Generic OpenAI- and Anthropic-compatible endpoints
        are also supported. Most routers use Chat Completions; OpenCode Go also exposes Responses and Anthropic Messages
        depending on the model.
      </p>
    </div>
  );
}
