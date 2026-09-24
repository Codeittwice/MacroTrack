import { describe, expect, it } from 'vitest';
import { assertAiEvaluationFixtures, evaluateAiFixtures, type AiEvaluationFixture } from './evaluation';

const FIXTURES: AiEvaluationFixture[] = [
  { id: 'one', description: 'One', expected: { kcal: 100, protein: 10 }, raw: { kcal: 130, protein: 8 }, grounded: { kcal: 110, protein: 9 } },
  { id: 'two', description: 'Two', expected: { kcal: 200, protein: 20 }, raw: { kcal: 180, protein: 24 }, grounded: { kcal: 190, protein: 21 } },
];

describe('evaluateAiFixtures', () => {
  it('reports absolute and percentage error for raw and grounded estimates', () => {
    const result = evaluateAiFixtures(FIXTURES);
    expect(result.fixtureCount).toBe(2);
    expect(result.raw.kcal).toMatchObject({ meanAbsoluteError: 25, meanAbsolutePercentError: 20 });
    expect(result.raw.protein).toMatchObject({ meanAbsoluteError: 3, meanAbsolutePercentError: 20 });
    expect(result.grounded.kcal.meanAbsoluteError).toBe(10);
    expect(result.grounded.kcal.meanAbsolutePercentError).toBeCloseTo(7.5);
    expect(result.grounded.protein.meanAbsoluteError).toBe(1);
    expect(result.grounded.protein.meanAbsolutePercentError).toBeCloseTo(7.5);
  });

  it('rejects malformed fixtures before calculating metrics', () => {
    expect(() => assertAiEvaluationFixtures([{ id: 'bad', description: '', expected: { kcal: 0, protein: 1 } }])).toThrow('id and description');
  });
});
