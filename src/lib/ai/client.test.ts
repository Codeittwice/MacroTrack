import { describe, expect, it, vi } from 'vitest';
import { estimateMeal } from './client';

const ESTIMATE = { items: [{ name: 'Yoghurt', grams: 150, nutrients: { kcal: 120, protein: 10, carbs: 12, fat: 3 }, confidence: 0.8, foodQuery: 'yoghurt' }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('estimateMeal', () => {
  it('uses only the selected Claude key and validates its structured result', async () => {
    const fetcher = vi.fn(async () => response({ content: [{ type: 'text', text: JSON.stringify(ESTIMATE) }] }));
    await expect(estimateMeal({ provider: 'claude', apiKey: 'secret-key', description: 'Bowl of yoghurt' }, fetcher)).resolves.toEqual(ESTIMATE);
    expect(fetcher).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'secret-key', 'anthropic-dangerous-direct-browser-access': 'true' }) }));
  });

  it('parses OpenAI and Gemini response envelopes without accepting malformed output', async () => {
    const openAi = vi.fn(async () => response({ choices: [{ message: { content: JSON.stringify(ESTIMATE) } }] }));
    const gemini = vi.fn(async () => response({ candidates: [{ content: { parts: [{ text: JSON.stringify(ESTIMATE) }] } }] }));
    await expect(estimateMeal({ provider: 'openai', apiKey: 'key', description: 'Yoghurt' }, openAi)).resolves.toEqual(ESTIMATE);
    await expect(estimateMeal({ provider: 'gemini', apiKey: 'key', description: 'Yoghurt' }, gemini)).resolves.toEqual(ESTIMATE);
    expect(gemini).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-goog-api-key': 'key' }) }),
    );
    await expect(estimateMeal({ provider: 'openai', apiKey: 'key', description: 'Yoghurt' }, async () => response({ choices: [{ message: { content: '{}' } }] }))).rejects.toThrow('valid meal estimate');
  });

  it('rejects empty input and provider failures without exposing the API key', async () => {
    await expect(estimateMeal({ provider: 'claude', apiKey: '', description: 'Lunch' })).rejects.toThrow('Add an API key');
    await expect(estimateMeal({ provider: 'claude', apiKey: 'private-key', description: '' })).rejects.toThrow('Describe the meal or add a photo');
    await expect(estimateMeal({ provider: 'claude', apiKey: 'private-key', description: 'Lunch' }, async () => response({}, 401))).rejects.not.toThrow('private-key');
    await expect(estimateMeal({ provider: 'claude', apiKey: 'key', description: 'x'.repeat(2_001) })).rejects.toThrow('under 2,000');
  });
});

describe('estimateMeal with a photo', () => {
  const image = { mediaType: 'image/jpeg', base64: 'AAAA' };
  const body = (fetcher: ReturnType<typeof vi.fn>) => JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

  it('sends the photo to Claude as a base64 image block on the vision model', async () => {
    const fetcher = vi.fn(async () => response({ content: [{ type: 'text', text: JSON.stringify(ESTIMATE) }] }));
    await estimateMeal({ provider: 'claude', apiKey: 'k', description: '', image }, fetcher);
    const sent = body(fetcher);
    expect(sent.model).toBe('claude-sonnet-5');
    expect(sent.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
  });

  it('sends the photo to OpenAI as a data URL and to Gemini as inline data', async () => {
    const openai = vi.fn(async () => response({ choices: [{ message: { content: JSON.stringify(ESTIMATE) } }] }));
    await estimateMeal({ provider: 'openai', apiKey: 'k', description: 'half portion', image }, openai);
    expect(body(openai).messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } });

    const gemini = vi.fn(async () => response({ candidates: [{ content: { parts: [{ text: JSON.stringify(ESTIMATE) }] } }] }));
    await estimateMeal({ provider: 'gemini', apiKey: 'k', description: '', image }, gemini);
    expect(body(gemini).contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } });
  });

  it('rejects unsupported or oversized images before any request', async () => {
    const fetcher = vi.fn();
    await expect(estimateMeal({ provider: 'claude', apiKey: 'k', description: '', image: { mediaType: 'image/tiff', base64: 'AA' } }, fetcher)).rejects.toThrow('JPEG, PNG or WebP');
    await expect(estimateMeal({ provider: 'claude', apiKey: 'k', description: '', image: { mediaType: 'image/jpeg', base64: 'A'.repeat(5_000_000) } }, fetcher)).rejects.toThrow('under 3 MB');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
