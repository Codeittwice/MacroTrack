import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertAiEvaluationFixtures, evaluateAiFixtures } from '../src/lib/ai/evaluation';

const fixturePath = path.resolve('data/fixtures/ai-eval.json');
const fixtures: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
assertAiEvaluationFixtures(fixtures);
if (fixtures.length < 30) throw new Error(`Expected at least 30 AI evaluation fixtures; found ${fixtures.length}.`);

const result = evaluateAiFixtures(fixtures);
const format = (value: number) => value.toFixed(1);
console.log(`AI evaluation: ${result.fixtureCount} Dutch meal/product fixtures`);
console.log(`Raw      kcal MAE ${format(result.raw.kcal.meanAbsoluteError)}, MAPE ${format(result.raw.kcal.meanAbsolutePercentError)}%; protein MAE ${format(result.raw.protein.meanAbsoluteError)} g, MAPE ${format(result.raw.protein.meanAbsolutePercentError)}%`);
console.log(`Grounded kcal MAE ${format(result.grounded.kcal.meanAbsoluteError)}, MAPE ${format(result.grounded.kcal.meanAbsolutePercentError)}%; protein MAE ${format(result.grounded.protein.meanAbsoluteError)} g, MAPE ${format(result.grounded.protein.meanAbsolutePercentError)}%`);

if (result.grounded.kcal.meanAbsolutePercentError >= result.raw.kcal.meanAbsolutePercentError || result.grounded.protein.meanAbsolutePercentError >= result.raw.protein.meanAbsolutePercentError) {
  throw new Error('Grounding must improve both calorie and protein MAPE over the raw estimates.');
}
