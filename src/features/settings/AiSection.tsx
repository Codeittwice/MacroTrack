import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, Label, Segmented } from '@/components/ui';
import { Section } from './Section';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import type { AiProviderId, Settings } from '@/db/types';

const PROVIDERS: { value: AiProviderId; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
];

function ApiKeyField({
  label, value, onSave,
}: { label: string; value: string | undefined; onSave: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const [show, setShow] = useState(false);
  useEffect(() => setDraft(value ?? ''), [value]);

  return (
    <div className="mb-3">
      <Label>{label} API key</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onSave(draft.trim() ? draft.trim() : undefined)}
          className="pr-10"
          placeholder="Not set"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted"
          aria-label={show ? 'Hide key' : 'Show key'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export function AiSection() {
  const settings = useSettings();

  function saveKey(provider: AiProviderId, value: string | undefined) {
    const apiKeys: Settings['apiKeys'] = { ...settings.apiKeys };
    if (value) apiKeys[provider] = value;
    else delete apiKeys[provider];
    updateSettings({ apiKeys });
  }

  return (
    <Section title="AI">
      <div className="mb-4">
        <div className="mb-1.5 text-sm text-muted">Provider</div>
        <Segmented<AiProviderId> value={settings.aiProvider} onChange={(aiProvider) => updateSettings({ aiProvider })} options={PROVIDERS} />
      </div>
      {PROVIDERS.map((p) => (
        <ApiKeyField key={p.value} label={p.label} value={settings.apiKeys[p.value]} onSave={(v) => saveKey(p.value, v)} />
      ))}
      {/* TODO(ai-team): add a "Test key" button per provider here once the AI client is wired up. No network calls belong in this file yet. */}
      <p className="text-xs text-muted">Keys are stored only on this device and are sent only to the provider you choose.</p>
    </Section>
  );
}
