import type { AiProviderId } from '@/db/types';
import { aiMealEstimateSchema, type AiMealEstimate } from './grounding';

export interface EstimateMealInput {
  provider: AiProviderId;
  apiKey: string;
  description: string;
}

type Fetcher = typeof fetch;

const MODELS: Record<AiProviderId, string> = {
  claude: 'claude-haiku-4-5',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-flash',
};
const MAX_DESCRIPTION_LENGTH = 2_000;

const OUTPUT_INSTRUCTIONS = `Return JSON only, with this shape: {"items":[{"name":string,"grams":number,"nutrients":{"kcal":number,"protein":number,"carbs":number,"fat":number},"confidence":number,"foodQuery":string?}]}. Identify each food separately. grams and nutrients describe the eaten portion. confidence is 0 to 1. Do not provide medical advice.`;

function parseJson(text: string): AiMealEstimate {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return aiMealEstimateSchema.parse(JSON.parse(trimmed));
  } catch {
    throw new Error('The AI response was not a valid meal estimate.');
  }
}

async function requireOk(response: Response): Promise<void> {
  if (!response.ok) throw new Error(`The AI provider could not complete this estimate (${response.status}).`);
}

function prompt(description: string): string {
  return `${OUTPUT_INSTRUCTIONS}\n\nMeal description: ${description}`;
}

async function estimateClaude(apiKey: string, description: string, fetcher: Fetcher): Promise<AiMealEstimate> {
  const response = await fetcher('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    // Direct browser access must be opted into explicitly, or Anthropic rejects the CORS preflight.
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: MODELS.claude, max_tokens: 1200, messages: [{ role: 'user', content: prompt(description) }] }),
  });
  await requireOk(response);
  const data = await response.json() as { content?: { type?: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('The AI provider returned no meal estimate.');
  return parseJson(text);
}

async function estimateOpenAi(apiKey: string, description: string, fetcher: Fetcher): Promise<AiMealEstimate> {
  const response = await fetcher('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODELS.openai, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: OUTPUT_INSTRUCTIONS }, { role: 'user', content: description }] }),
  });
  await requireOk(response);
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('The AI provider returned no meal estimate.');
  return parseJson(text);
}

async function estimateGemini(apiKey: string, description: string, fetcher: Fetcher): Promise<AiMealEstimate> {
  const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt(description) }] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  await requireOk(response);
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new Error('The AI provider returned no meal estimate.');
  return parseJson(text);
}

/** Calls only the selected provider. API keys stay in memory for the request and are never logged. */
export async function estimateMeal(input: EstimateMealInput, fetcher: Fetcher = fetch): Promise<AiMealEstimate> {
  const description = input.description.trim();
  const apiKey = input.apiKey.trim();
  if (!description) throw new Error('Describe the meal before estimating it.');
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error('Keep the meal description under 2,000 characters.');
  if (!apiKey) throw new Error('Add an API key for the selected provider in Settings.');
  if (input.provider === 'claude') return estimateClaude(apiKey, description, fetcher);
  if (input.provider === 'openai') return estimateOpenAi(apiKey, description, fetcher);
  return estimateGemini(apiKey, description, fetcher);
}
