import type { AiProviderId } from '@/db/types';
import { askProvider } from './client';

/** True when the text contains Cyrillic letters (e.g. Bulgarian). */
export const hasCyrillic = (text: string) => /[Ѐ-ӿ]/.test(text);

const INSTRUCTIONS = 'You translate meal descriptions into English for a nutrition app. Keep every quantity, unit, brand and shop name exactly (e.g. "Kaufland", "Billa"). Translate dish names to their usual English name and keep the Bulgarian dish name in brackets when there is no common English one (e.g. "banitsa (баница)"). Return only the translation, no quotes or explanations.';

/** Translates a (Bulgarian) meal description to English with the user's selected provider. */
export async function translateToEnglish(text: string, provider: AiProviderId, apiKey: string, fetcher: typeof fetch = fetch): Promise<string> {
  const source = text.trim();
  if (!source) return '';
  if (!apiKey.trim()) throw new Error('Add an API key for the selected provider in Settings to translate.');
  const out = await askProvider({ provider, apiKey: apiKey.trim(), instructions: INSTRUCTIONS, userText: `Translate to English:\n${source}`, json: false }, fetcher);
  // Gemini/OpenAI are asked for JSON elsewhere; strip quotes or a JSON wrapper if a model adds one.
  const cleaned = out.trim().replace(/^```\w*\s*|\s*```$/g, '').replace(/^"|"$/g, '');
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === 'object') {
      const v = Object.values(parsed as Record<string, unknown>).find((x) => typeof x === 'string');
      if (typeof v === 'string') return v.trim();
    }
  } catch { /* plain text, as requested */ }
  return cleaned;
}
