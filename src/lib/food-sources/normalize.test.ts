import { describe, it, expect } from 'vitest';
import { normalizeQuery, normalizeText, stemNl } from './normalize';

describe('normalizeText', () => {
  it('lowercases, strips diacritics and punctuation', () => {
    expect(normalizeText('Kipfilet, rauw!')).toBe('kipfilet rauw');
    expect(normalizeText('Pindakaas (100g)')).toBe('pindakaas 100g');
    expect(normalizeText('café crème')).toBe('cafe creme');
  });
});

describe('stemNl', () => {
  it('handles diminutive plurals', () => {
    expect(stemNl('broodjes')).toBe('brood');
    expect(stemNl('broodje')).toBe('brood');
    expect(stemNl('huisjes')).toBe('huis');
    expect(stemNl('appeltje')).toBe('appel');
    expect(stemNl('appeltjes')).toBe('appel');
  });

  it('handles -en with doubled-consonant undoubling', () => {
    expect(stemNl('kipfiletten')).toBe('kipfilet');
  });

  it('handles plain -s plurals conservatively', () => {
    expect(stemNl('tomaten')).not.toBe('');
  });

  it('never returns empty or too-short stems', () => {
    expect(stemNl('ei')).toBe('ei');
    expect(stemNl('jus')).toBe('jus');
  });

  it('is idempotent-ish on already-stemmed words', () => {
    expect(stemNl(stemNl('broodjes'))).toBe('brood');
  });
});

describe('normalizeQuery', () => {
  it('extracts a brand prefix and stems the remaining tokens', () => {
    const r = normalizeQuery('AH turkse broodjes');
    expect(r.brand).toBe('ah');
    expect(r.text).not.toContain('ah');
    expect(r.tokens).toContain('turks');
    expect(r.tokens).toContain('brood');
  });

  it('recognises multi-word brand prefixes first', () => {
    const r = normalizeQuery('Albert Heijn kipfilet');
    expect(r.brand).toBe('ah');
    expect(r.tokens).toContain('kipfilet');
  });

  it('canonicalises synonym tokens', () => {
    const r = normalizeQuery('turkse brood');
    expect(r.tokens).toContain('turks');
  });
});
