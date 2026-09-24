export interface NutritionTotals {
  kcal: number;
  protein: number;
}

export interface AiEvaluationFixture {
  id: string;
  description: string;
  expected: NutritionTotals;
  raw: NutritionTotals;
  grounded: NutritionTotals;
}

export interface ErrorMetrics {
  meanAbsoluteError: number;
  meanAbsolutePercentError: number;
}

export interface AiEvaluationResult {
  fixtureCount: number;
  raw: Record<keyof NutritionTotals, ErrorMetrics>;
  grounded: Record<keyof NutritionTotals, ErrorMetrics>;
}

function metrics(fixtures: AiEvaluationFixture[], field: keyof NutritionTotals, prediction: 'raw' | 'grounded'): ErrorMetrics {
  const errors = fixtures.map((fixture) => Math.abs(fixture[prediction][field] - fixture.expected[field]));
  return {
    meanAbsoluteError: errors.reduce((sum, value) => sum + value, 0) / errors.length,
    meanAbsolutePercentError: errors.reduce((sum, value, index) => sum + value / fixtures[index].expected[field], 0) / errors.length * 100,
  };
}

export function assertAiEvaluationFixtures(value: unknown): asserts value is AiEvaluationFixture[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('AI evaluation fixtures must be a non-empty array.');
  for (const fixture of value) {
    if (!fixture || typeof fixture !== 'object') throw new Error('AI evaluation fixture must be an object.');
    const candidate = fixture as Partial<AiEvaluationFixture>;
    if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.description !== 'string' || !candidate.description) throw new Error('AI evaluation fixture needs an id and description.');
    for (const totals of [candidate.expected, candidate.raw, candidate.grounded]) {
      if (!totals || !Number.isFinite(totals.kcal) || totals.kcal <= 0 || !Number.isFinite(totals.protein) || totals.protein < 0) throw new Error(`AI evaluation fixture ${candidate.id} has invalid nutrition totals.`);
    }
  }
}

export function evaluateAiFixtures(fixtures: AiEvaluationFixture[]): AiEvaluationResult {
  assertAiEvaluationFixtures(fixtures);
  return {
    fixtureCount: fixtures.length,
    raw: { kcal: metrics(fixtures, 'kcal', 'raw'), protein: metrics(fixtures, 'protein', 'raw') },
    grounded: { kcal: metrics(fixtures, 'kcal', 'grounded'), protein: metrics(fixtures, 'protein', 'grounded') },
  };
}
