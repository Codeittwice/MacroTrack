import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { importHistory, parseCsv, parseDate, parseHistory } from './history';

beforeEach(async () => {
  await db.weights.clear();
  await db.logEntries.clear();
});

const MFP = `Date,Meal,Time,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Note
2026-09-01,Breakfast,8:02 AM,420.5,12,3,1,2,0,10,300,200,55,6,12,22,
2026-09-01,Lunch,12:30 PM,650,20,5,2,3,0,40,800,400,70,8,5,40,
2026-09-01,Lunch,3:00 PM,150,5,1,1,1,0,0,50,50,20,2,15,3,
2026-09-02,Dinner,7:00 PM,"1,020",40,12,4,6,0,90,1200,900,95,9,10,60,"note, with comma"`;

describe('history import', () => {
  it('parses quoted CSV cells with commas and escaped quotes', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
    expect(parseCsv('a;b\r\n1,5;2')).toEqual([['a', 'b'], ['1,5', '2']]);
  });

  it('parses ISO, Dutch and unambiguous US dates', () => {
    expect(parseDate('2026-09-25')).toBe('2026-09-25');
    expect(parseDate('25-09-2026')).toBe('2026-09-25');
    expect(parseDate('9/25/2026')).toBe('2026-09-25');
    expect(parseDate('03/04/2026')).toBe('2026-04-03'); // ambiguous: day first
    expect(parseDate('yesterday')).toBeUndefined();
  });

  it('reads a MyFitnessPal nutrition export and sums rows per meal', async () => {
    const parsed = parseHistory(MFP);
    expect(parsed.intake).toHaveLength(4);
    expect(parsed.intake[3].nutrients).toMatchObject({ kcal: 1020, protein: 60, carbs: 95, fat: 40, sodium: 1200 });
    const res = await importHistory(parsed, { source: 'MyFitnessPal', weightUnit: 'kg' });
    expect(res.days).toBe(2);
    const lunch = (await db.logEntries.where('date').equals('2026-09-01').toArray()).find((e) => e.meal === 1)!;
    expect(lunch.nutrients.kcal).toBe(800);
    expect(lunch.name).toBe('MyFitnessPal · Lunch');
  });

  it('reads weights with a unit in the header, converts lb, and is idempotent on re-import', async () => {
    const csv = 'Date,Weight (lbs),Trend Weight (lbs)\n2026-09-01,180.0,181\n2026-09-02,179.4,180.8\n';
    const parsed = parseHistory(csv);
    expect(parsed.weightUnit).toBe('lb');
    expect(parsed.weights).toEqual([{ date: '2026-09-01', value: 180 }, { date: '2026-09-02', value: 179.4 }]);
    await importHistory(parsed, { source: 'MacroFactor', weightUnit: 'lb' });
    await importHistory(parsed, { source: 'MacroFactor', weightUnit: 'lb' });
    const rows = await db.weights.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.date === '2026-09-01')!.kg).toBeCloseTo(81.6, 1);
  });

  it('reads a daily-totals sheet with Dutch headers and skips unusable rows', () => {
    const parsed = parseHistory('Datum;Gewicht (kg);Energie (kcal);Eiwit;Koolhydraten;Vet\n01-09-2026;82,4;2100;150;200;70\ntotaal;;;;;\n');
    expect(parsed.weights).toEqual([{ date: '2026-09-01', value: 82.4 }]);
    expect(parsed.intake[0].nutrients).toMatchObject({ kcal: 2100, protein: 150, carbs: 200, fat: 70 });
    expect(parsed.skippedRows).toBe(1);
  });
});
