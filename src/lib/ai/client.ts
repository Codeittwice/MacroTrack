import type { AiProviderId } from '@/db/types';
import { aiMealEstimateSchema, type AiMealEstimate } from './grounding';

export interface MealImage {
  /** e.g. 'image/jpeg' */
  mediaType: string;
  /** base64 without the data: prefix */
  base64: string;
}

export interface EstimateMealInput {
  provider: AiProviderId;
  apiKey: string;
  description: string;
  /** Optional meal photo; the description then adds context (e.g. "I ate half"). */
  image?: MealImage;
}

type Fetcher = typeof fetch;

const MODELS: Record<AiProviderId, string> = {
  claude: 'claude-haiku-4-5',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-flash',
};
/** Photos need a stronger vision model; text stays on the cheaper one. */
const VISION_MODELS: Record<AiProviderId, string> = {
  claude: 'claude-sonnet-5',
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.5-flash',
};
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_IMAGE_BASE64 = 4_500_000; // ~3.3 MB decoded; the UI downsizes well below this

const OUTPUT_INSTRUCTIONS = `Return JSON only, with this shape: {"items":[{"name":string,"grams":number,"nutrients":{"kcal":number,"protein":number,"carbs":number,"fat":number},"confidence":number,"foodQuery":string?}]}. Identify each food separately. grams and nutrients describe the eaten portion. confidence is 0 to 1. The user is in the Netherlands: recognise Dutch dishes and supermarket products (Albert Heijn, Jumbo, Lidl, Aldi, Plus) and use typical Dutch portion sizes (a slice of bread is about 35 g, a Turks brood portion about 90 g). Set foodQuery to a short Dutch generic food name as used in the Dutch food composition table (NEVO), e.g. "Brood Turks", "Kipfilet bereid", "Rijst witte gekookt", so the item can be matched to reference data. Estimate cooked weights for cooked foods and list cooking fat and sauces as separate items. Do not provide medical advice.`;

function parseJson(text: string): AiMealEstimate {
  const trimmed = stripJsonFence(text);
  try {
    return aiMealEstimateSchema.parse(JSON.parse(trimmed));
  } catch {
    throw new Error('The AI response was not a valid meal estimate.');
  }
}

async function requireOk(response: Response): Promise<void> {
  if (response.ok) return;
  // Gemini answers an invalid key with 400 "API key not valid" rather than 401.
  const keyProblem = response.status === 401 || response.status === 403
    || (response.status === 400 && /api key/i.test(await response.clone().text().catch(() => '')));
  if (keyProblem) throw new Error(`The provider rejected this API key (${response.status}). Check it in Settings.`);
  if (response.status === 429) throw new Error('The provider is rate limiting or out of credit (429). Try again later or check your plan.');
  throw new Error(`The AI provider could not complete this estimate (${response.status}).`);
}

export interface ProviderRequest {
  provider: AiProviderId;
  apiKey: string;
  /** Output contract and rules (system prompt for OpenAI, prefix for Claude/Gemini). */
  instructions: string;
  userText: string;
  image?: MealImage;
}

/**
 * Sends one request to the selected provider and returns its raw text answer. Shared by meal
 * estimates and label scanning so every AI call uses the same transport, key handling and CORS
 * opt-in. Photos use the provider's vision model.
 */
export async function askProvider(req: ProviderRequest, fetcher: Fetcher = fetch): Promise<string> {
  const { provider, apiKey, instructions, userText, image } = req;
  const combined = `${instructions}\n\n${userText}`;
  let text: string | undefined;
  if (provider === 'claude') {
    const content = image
      ? [{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } }, { type: 'text', text: combined }]
      : combined;
    const response = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      // Direct browser access must be opted into explicitly, or Anthropic rejects the CORS preflight.
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: image ? VISION_MODELS.claude : MODELS.claude, max_tokens: 1500, messages: [{ role: 'user', content }] }),
    });
    await requireOk(response);
    const data = await response.json() as { content?: { type?: string; text?: string }[] };
    text = data.content?.find((block) => block.type === 'text')?.text;
  } else if (provider === 'openai') {
    const user = image
      ? [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } }]
      : userText;
    const response = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: image ? VISION_MODELS.openai : MODELS.openai, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: instructions }, { role: 'user', content: user }] }),
    });
    await requireOk(response);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    text = data.choices?.[0]?.message?.content;
  } else {
    const parts = image ? [{ inline_data: { mime_type: image.mediaType, data: image.base64 } }, { text: combined }] : [{ text: combined }];
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    await requireOk(response);
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    text = data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  }
  if (!text) throw new Error('The AI provider returned an empty answer.');
  return text;
}

/** Strips a Markdown code fence some models wrap around JSON. */
export function stripJsonFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export function validateImage(image: MealImage | undefined): void {
  if (image && (!/^image\/(jpeg|png|webp|gif)$/.test(image.mediaType) || image.base64.length > MAX_IMAGE_BASE64)) {
    throw new Error('Use a JPEG, PNG or WebP photo under 3 MB.');
  }
}

/** Calls only the selected provider. API keys stay in memory for the request and are never logged. */
export async function estimateMeal(input: EstimateMealInput, fetcher: Fetcher = fetch): Promise<AiMealEstimate> {
  const description = input.description.trim();
  const apiKey = input.apiKey.trim();
  if (!description && !input.image) throw new Error('Describe the meal or add a photo before estimating it.');
  validateImage(input.image);
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error('Keep the meal description under 2,000 characters.');
  if (!apiKey) throw new Error('Add an API key for the selected provider in Settings.');
  const userText = input.image
    ? `Estimate the meal in this photo.${description ? ` Extra context from the user: ${description}` : ''}`
    : `Meal description: ${description}`;
  return parseJson(await askProvider({ provider: input.provider, apiKey, instructions: OUTPUT_INSTRUCTIONS, userText, image: input.image }, fetcher));
}
