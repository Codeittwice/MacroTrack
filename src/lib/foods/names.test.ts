import { describe, expect, it } from 'vitest';
import { foodNames } from './names';

const rice = { name: 'Rijst witte gekookt', nameEn: 'Rice white boiled' };

describe('foodNames', () => {
  it('shows English, Dutch, or English with Dutch underneath', () => {
    expect(foodNames(rice, 'en')).toEqual({ primary: 'Rice white boiled' });
    expect(foodNames(rice, 'nl')).toEqual({ primary: 'Rijst witte gekookt' });
    expect(foodNames(rice, 'both')).toEqual({ primary: 'Rice white boiled', secondary: 'Rijst witte gekookt' });
  });

  it('falls back to the source name when there is no English one, and skips identical names', () => {
    expect(foodNames({ name: 'Hummus' }, 'en')).toEqual({ primary: 'Hummus' });
    expect(foodNames({ name: 'Hummus', nameEn: 'hummus' }, 'both')).toEqual({ primary: 'hummus' });
  });
});
