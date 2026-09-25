import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input, Label, Segmented } from '@/components/ui';
import { estimateMeal } from '@/lib/ai';
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
      <TestKey provider={settings.aiProvider} apiKey={settings.apiKeys[settings.aiProvider]} />
      <p className="text-xs text-muted">Keys are stored only on this device and are sent only to the provider you choose.</p>
    </Section>
  );
}

/** Sends one tiny estimate ("1 banana") to the selected provider so the user knows the key works. */
function TestKey({ provider, apiKey }: { provider: AiProviderId; apiKey: string | undefined }) {
  const [state, setState] = useState<{ busy: boolean; message?: string; ok?: boolean }>({ busy: false });
  useEffect(() => setState({ busy: false }), [provider, apiKey]);
  const name = PROVIDERS.find((p) => p.value === provider)?.label ?? provider;
  const run = async () => {
    setState({ busy: true });
    try {
      const result = await estimateMeal({ provider, apiKey: apiKey ?? '', description: '1 banana' });
      const kcal = Math.round(result.items.reduce((sum, item) => sum + item.nutrients.kcal, 0));
      setState({ busy: false, ok: true, message: `${name} works: 1 banana is about ${kcal} kcal.` });
    } catch (error) {
      setState({ busy: false, ok: false, message: error instanceof Error ? error.message : 'The key could not be verified.' });
    }
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <Button size="sm" disabled={!apiKey || state.busy} onClick={() => void run()}>{state.busy ? 'Testing…' : `Test ${name} key`}</Button>
      {state.message && <span role="status" className="text-sm" style={{ color: state.ok ? 'var(--success)' : 'var(--danger)' }}>{state.message}</span>}
    </div>
  );
}
