import { describe, expect, it, vi } from 'vitest';
import { hasCyrillic, translateToEnglish } from './translate';
import { transcribe } from '@/lib/native/speech';

const claudeReply = (text: string) => vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 }));

describe('Bulgarian translation', () => {
  it('detects Cyrillic', () => {
    expect(hasCyrillic('две филийки хляб с кашкавал')).toBe(true);
    expect(hasCyrillic('2 turkse broodjes')).toBe(false);
  });

  it('translates with the selected provider and returns plain text', async () => {
    const fetcher = claudeReply('two slices of bread with kashkaval cheese');
    const out = await translateToEnglish('две филийки хляб с кашкавал', 'claude', 'k', fetcher as unknown as typeof fetch);
    expect(out).toBe('two slices of bread with kashkaval cheese');
    const body = JSON.parse(fetcher.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toContain('две филийки хляб с кашкавал');
  });

  it('does not force JSON mode for OpenAI translations', async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: 'banitsa (баница) with yoghurt' } }] }), { status: 200 }));
    expect(await translateToEnglish('баница с кисело мляко', 'openai', 'k', fetcher as unknown as typeof fetch)).toBe('banitsa (баница) with yoghurt');
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string).response_format).toBeUndefined();
  });
});

describe('transcription fallback', () => {
  const audio = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

  it('sends audio to OpenAI with the spoken language', async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ text: ' баница ' }), { status: 200 }));
    expect(await transcribe(audio, { provider: 'openai', apiKey: 'k', lang: 'bg-BG' }, fetcher as unknown as typeof fetch)).toBe('баница');
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get('language')).toBe('bg');
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
  });

  it('sends audio inline to Gemini and refuses Claude', async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'kwark met banaan' }] } }] }), { status: 200 }));
    expect(await transcribe(audio, { provider: 'gemini', apiKey: 'k', lang: 'nl-NL' }, fetcher as unknown as typeof fetch)).toBe('kwark met banaan');
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string).contents[0].parts[0].inline_data.data).toBe('AQID');
    await expect(transcribe(audio, { provider: 'claude', apiKey: 'k', lang: 'en-US' })).rejects.toThrow('Gemini or OpenAI');
  });
});
