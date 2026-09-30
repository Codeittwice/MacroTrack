import { describe, expect, it } from 'vitest';
import { withDefaults } from './repo';

describe('withDefaults', () => {
  it('shows food names in English unless the user picked a language', () => {
    expect(withDefaults(undefined).foodNames).toBe('en');
    expect(withDefaults({ foodNames: 'both' }).foodNames).toBe('en');
    expect(withDefaults({ foodNames: 'both', foodNamesChosen: true }).foodNames).toBe('both');
    expect(withDefaults({ foodNames: 'nl' }).foodNames).toBe('nl');
  });
});
