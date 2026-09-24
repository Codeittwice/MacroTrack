import { describe, expect, it, vi } from 'vitest';
import { estimateMeal } from './client';

const ESTIMATE = { items: [{ name: 'Yoghurt', grams: 150, nutrients: { kcal: 120, protein: 10, carbs: 12, fat: 3 }, confidence: 0.8, foodQuery: 'yoghurt' }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('estimateMeal', () => {
  it('uses only the selected Claude key and validates its structured result', async () => {
    const fetcher = vi.fn(async () => response({ content: [{ type: 'text', text: JSON.stringify(ESTIMATE) }] }));
    await expect(estimateMeal({ provider: 'claude', apiKey: 'secret-key', description: 'Bowl of yoghurt' }, fetcher)).resolves.toEqual(ESTIMATE);
    expect(fetcher).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'secret-key' }) }));
  });

  it('parses OpenAI and Gemini response envelopes without accepting malformed output', async () => {
    const openAi = vi.fn(async () => response({ choices: [{ message: { content: JSON.stringify(ESTIMATE) } }] }));
    const gemini = vi.fn(async () => response({ candidates: [{ content: { parts: [{ text: JSON.stringify(ESTIMATE) }] } }] }));
    await expect(estimateMeal({ provider: 'openai', apiKey: 'key', description: 'Yoghurt' }, openAi)).resolves.toEqual(ESTIMATE);
    await expect(estimateMeal({ provider: 'gemini', apiKey: 'key', description: 'Yoghurt' }, gemini)).resolves.toEqual(ESTIMATE);
    await expect(estimateMeal({ provider: 'openai', apiKey: 'key', description: 'Yoghurt' }, async () => response({ choices: [{ message: { content: '{}' } }] }))).rejects.toThrow('valid meal estimate');
  });

  it('rejects empty input and provider failures without exposing the API key', async () => {
    await expect(estimateMeal({ provider: 'claude', apiKey: '', description: 'Lunch' })).rejects.toThrow('Add an API key');
    await expect(estimateMeal({ provider: 'claude', apiKey: 'private-key', description: '' })).rejects.toThrow('Describe the meal');
    await expect(estimateMeal({ provider: 'claude', apiKey: 'private-key', description: 'Lunch' }, async () => response({}, 401))).rejects.not.toThrow('private-key');
  });
});
