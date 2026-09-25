import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  detectDelimiter,
  parseNevoCsv,
  decodeBuffer,
  buildNevoFile,
  type NevoRow_Internal,
} from './build-nevo';
import { detectNevoVersion } from './build-nevo';

const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/nevo-sample.csv');
const fixtureText = readFileSync(fixturePath, 'utf-8');

function byNameNl(rows: NevoRow_Internal[], name: string): NevoRow_Internal {
  const row = rows.find((r) => r.nameNl === name);
  if (!row) throw new Error(`row not found: ${name}`);
  return row;
}

describe('detectDelimiter', () => {
  it('detects "|" for the real fixture header', () => {
    const headerLine = fixtureText.split(/\r\n|\r|\n/)[0] as string;
    expect(detectDelimiter(headerLine)).toBe('|');
  });

  it('detects ";" for a semicolon-converted variant', () => {
    const semicolonText = fixtureText.replace(/\|/g, ';');
    const headerLine = semicolonText.split(/\r\n|\r|\n/)[0] as string;
    expect(detectDelimiter(headerLine)).toBe(';');
  });
});

describe('parseNevoCsv', () => {
  it('parses the same rows whether delimited by "|" or ";"', () => {
    const pipeRows = parseNevoCsv(fixtureText);
    const semicolonRows = parseNevoCsv(fixtureText.replace(/\|/g, ';'));
    expect(semicolonRows).toEqual(pipeRows);
  });

  it('parses the expected number of rows', () => {
    const rows = parseNevoCsv(fixtureText);
    expect(rows.length).toBe(9);
  });

  it('parses "Brood Turks" fields correctly, including Dutch decimal commas', () => {
    const rows = parseNevoCsv(fixtureText);
    const brood = byNameNl(rows, 'Brood, Turks');
    expect(brood.code).toBe(101);
    expect(brood.nameEn).toBe('Turkish bread');
    expect(brood.synonyms).toBe('Turks brood');
    expect(brood.group).toBe('Brood');
    expect(brood.unit).toBe('g');
    expect(brood.kcal).toBeCloseTo(250.5, 1);
    expect(brood.protein).toBeCloseTo(8.5, 1);
    expect(brood.carbs).toBeCloseTo(48.2, 1);
    expect(brood.fat).toBeCloseTo(2.1, 1);
    expect(brood.fiber).toBeCloseTo(3.0, 1);
    expect(brood.sugar).toBeCloseTo(3.5, 1);
    expect(brood.satFat).toBeCloseTo(0.4, 1);
    expect(brood.sodium).toBeCloseTo(480, 1);
    expect(brood.alcohol).toBeCloseTo(0, 1);
  });

  it('sets unit to "ml" for per-100ml rows', () => {
    const rows = parseNevoCsv(fixtureText);
    const yoghurt = byNameNl(rows, 'Yoghurt, volle');
    expect(yoghurt.unit).toBe('ml');
    const melk = byNameNl(rows, 'Melk, halfvolle');
    expect(melk.unit).toBe('ml');
  });

  it('treats empty macro cells as 0 and empty optionals as null', () => {
    const rows = parseNevoCsv(fixtureText);
    const empty = byNameNl(rows, 'Testproduct leeg');
    expect(empty.kcal).toBe(0);
    expect(empty.protein).toBe(0);
    expect(empty.carbs).toBe(0);
    expect(empty.fat).toBe(0);
    expect(empty.fiber).toBeNull();
    expect(empty.sugar).toBeNull();
    expect(empty.satFat).toBeNull();
    expect(empty.sodium).toBeNull();
    expect(empty.alcohol).toBeNull();
  });

  it('falls back to ENERCJ / 4.184 when ENERCC is missing', () => {
    const rows = parseNevoCsv(fixtureText);
    const kjRow = byNameNl(rows, 'Testproduct kJ');
    const expectedKcal = Math.round((1000 / 4.184) * 10) / 10;
    expect(kjRow.kcal).toBeCloseTo(expectedKcal, 1);
  });

  it('keeps values exactly as published (RIVM terms forbid changing the data)', () => {
    const csv = fixtureText.replace(/250,5/, '250,57');
    const turks = parseNevoCsv(csv).find((r) => /Turks/.test(r.nameNl))!;
    expect(turks.kcal).toBe(250.57);
  });

  it('reads the NEVO version from the file name for the required attribution', () => {
    expect(detectNevoVersion('NEVO2025_v9.0.csv')).toBe('2025/9.0');
    expect(detectNevoVersion('NEVO-online 2027 10.0.csv')).toBe('2027/10.0');
    expect(detectNevoVersion('export.csv')).toBe('2025/9.0');
    expect(buildNevoFile([], 'NEVO2025_v9.0.csv').header.attribution).toBe('NEVO-online versie 2025/9.0, RIVM, Bilthoven');
  });

  it('tolerates XLSX-style headers with units and extra spaces', () => {
    const xlsxHeader =
      'NEVO-code| Voedingsmiddelgroep/Food group |Voedingsmiddelnaam/Dutch food name|Engelse naam/Food name|Synoniem|Hoeveelheid/Quantity|ENERCJ (kJ)|enercc (kcal)|PROT (g)|CHO (g)|FAT (g)|FIBT (g)|SUGAR (g)|FASAT (g)|NA (mg)|ALC (g)';
    const body = fixtureText.split(/\r\n|\r|\n/).slice(1).join('\n');
    const text = `${xlsxHeader}\n${body}`;
    const rows = parseNevoCsv(text);
    expect(rows.length).toBe(9);
    const brood = byNameNl(rows, 'Brood, Turks');
    expect(brood.kcal).toBeCloseTo(250.5, 1);
  });
});

describe('decodeBuffer', () => {
  it('decodes UTF-8 text normally', () => {
    const buf = Buffer.from('Crème fraîche', 'utf-8');
    expect(decodeBuffer(buf)).toBe('Crème fraîche');
  });

  it('falls back to latin1 when UTF-8 decoding produces replacement characters', () => {
    const buf = Buffer.from('Crème fraîche', 'latin1');
    expect(decodeBuffer(buf)).toBe('Crème fraîche');
  });

  it('strips a UTF-8 BOM', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('hello', 'utf-8')]);
    expect(decodeBuffer(buf)).toBe('hello');
  });
});

describe('buildNevoFile', () => {
  it('sets header.count to the row count and produces 15-element tuples', () => {
    const rows = parseNevoCsv(fixtureText);
    const file = buildNevoFile(rows);
    expect(file.header.count).toBe(rows.length);
    expect(file.header.version).toBe('2025/9.0');
    for (const row of file.rows) {
      expect(row.length).toBe(15);
    }
  });
});
