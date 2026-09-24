// Builds public/data/nevo.json from a NEVO2023 CSV export placed in data/raw/.
// See scripts/fixtures/README.md for a synthetic sample used by the tests.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types: the output contract lives in src/lib/food-sources/nevo-format.ts (shared with the app)
// ---------------------------------------------------------------------------

import type { NevoRow, NevoFile } from '../src/lib/food-sources/nevo-format';
export type { NevoRow, NevoFile };

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/** Decode a buffer as UTF-8, falling back to latin1 if replacement chars appear. Strips a UTF-8 BOM. */
export function decodeBuffer(buf: Buffer): string {
  let text = buf.toString('utf-8');
  if (text.includes('�')) {
    text = buf.toString('latin1');
  }
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Delimiter detection
// ---------------------------------------------------------------------------

const CANDIDATE_DELIMITERS = ['|', ';', '\t', ','] as const;

/** Count occurrences of a character in a line, ignoring characters inside double quotes. */
function countOutsideQuotes(line: string, ch: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      // Handle "" escape: if next char is also a quote, skip both and stay in same state.
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ch) count++;
  }
  return count;
}

/** Auto-detect the field delimiter from a header line by counting candidate delimiters outside quotes. */
export function detectDelimiter(headerLine: string): string {
  let best = CANDIDATE_DELIMITERS[0] as string;
  let bestCount = -1;
  for (const d of CANDIDATE_DELIMITERS) {
    const c = countOutsideQuotes(headerLine, d);
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// CSV line splitting (supports quoted fields with "" escapes)
// ---------------------------------------------------------------------------

function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        fields.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  fields.push(cur);
  return fields;
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

// ---------------------------------------------------------------------------
// Header matching
// ---------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h.trim().replace(/^"|"$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** First token of a header, splitting on space, '(', '/', '_' — used to match nutrient codes exactly. */
function firstToken(h: string): string {
  const norm = normalizeHeader(h);
  const token = norm.split(/[\s(/_]+/)[0] ?? '';
  return token;
}

interface ColumnMap {
  code: number;
  nameNl: number;
  nameEn: number;
  synonyms: number;
  group: number;
  quantity: number;
  nutrients: Record<string, number>;
}

const NUTRIENT_CODES = [
  'ENERCC',
  'ENERCJ',
  'PROT',
  'CHO',
  'FAT',
  'FIBT',
  'SUGAR',
  'SUGTOT',
  'FASAT',
  'NA',
  'ALC',
];

function buildColumnMap(headerFields: string[]): ColumnMap {
  const map: ColumnMap = {
    code: -1,
    nameNl: -1,
    nameEn: -1,
    synonyms: -1,
    group: -1,
    quantity: -1,
    nutrients: {},
  };

  headerFields.forEach((raw, idx) => {
    const norm = normalizeHeader(raw);
    if (map.code === -1 && (norm.includes('nevo-code') || norm.includes('nevo code') || norm === 'code')) {
      map.code = idx;
      return;
    }
    if (map.nameNl === -1 && (norm.includes('voedingsmiddelnaam') || norm.includes('dutch food name'))) {
      map.nameNl = idx;
      return;
    }
    if (
      map.nameEn === -1 &&
      !norm.includes('dutch food name') &&
      (norm.includes('engelse naam') || norm.includes('food name'))
    ) {
      map.nameEn = idx;
      return;
    }
    if (map.synonyms === -1 && (norm.includes('synoniem') || norm.includes('synonym'))) {
      map.synonyms = idx;
      return;
    }
    if (map.group === -1 && (norm.includes('voedingsmiddelgroep') || norm.includes('food group'))) {
      map.group = idx;
      return;
    }
    if (map.quantity === -1 && (norm.includes('hoeveelheid') || norm.includes('quantity'))) {
      map.quantity = idx;
      return;
    }
    const token = firstToken(raw).toUpperCase();
    if (NUTRIENT_CODES.includes(token) && map.nutrients[token] === undefined) {
      map.nutrients[token] = idx;
    }
  });

  return map;
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/** Parse a NEVO numeric cell: Dutch decimal commas, '<0,1'/'tr' treated as missing. Returns null if missing/non-numeric. */
function parseNevoNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim().replace(/^"|"$/g, '').trim();
  if (s === '' || s === '-') return null;
  if (/^tr\.?$/i.test(s)) return null;
  if (s.startsWith('<')) return null;
  s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

export interface NevoRow_Internal {
  code: number;
  nameNl: string;
  nameEn: string;
  synonyms: string;
  group: string;
  unit: 'g' | 'ml';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  satFat: number | null;
  sodium: number | null;
  alcohol: number | null;
}

function cell(fields: string[], idx: number): string {
  if (idx < 0 || idx >= fields.length) return '';
  return (fields[idx] ?? '').trim().replace(/^"|"$/g, '').trim();
}

/** Parse NEVO CSV text into row objects, ready to be mapped into the output tuple format. */
export function parseNevoCsv(text: string): NevoRow_Internal[] {
  const lines = splitLines(text).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0] as string);
  const headerFields = splitLine(lines[0] as string, delimiter);
  const map = buildColumnMap(headerFields);

  const rows: NevoRow_Internal[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as string;
    const fields = splitLine(line, delimiter);

    const codeRaw = cell(fields, map.code);
    const nameNl = cell(fields, map.nameNl);
    if (codeRaw === '' || nameNl === '') continue;

    const codeNum = parseInt(codeRaw, 10);
    if (!Number.isInteger(codeNum)) continue;

    const nameEn = cell(fields, map.nameEn);
    const synonyms = cell(fields, map.synonyms);
    const group = cell(fields, map.group);
    const quantity = cell(fields, map.quantity);
    const unit: 'g' | 'ml' = /ml/i.test(quantity) ? 'ml' : 'g';

    const enercc = parseNevoNumber(fields[map.nutrients.ENERCC as number]);
    const enercj = parseNevoNumber(fields[map.nutrients.ENERCJ as number]);
    let kcal: number;
    if (enercc !== null) {
      kcal = enercc;
    } else if (enercj !== null) {
      kcal = enercj / 4.184;
    } else {
      kcal = 0;
    }

    const protein = parseNevoNumber(fields[map.nutrients.PROT as number]) ?? 0;
    const carbs = parseNevoNumber(fields[map.nutrients.CHO as number]) ?? 0;
    const fat = parseNevoNumber(fields[map.nutrients.FAT as number]) ?? 0;

    const fiber = parseNevoNumber(fields[map.nutrients.FIBT as number]);
    const sugarRaw = parseNevoNumber(fields[map.nutrients.SUGAR as number]);
    const sugar = sugarRaw !== null ? sugarRaw : parseNevoNumber(fields[map.nutrients.SUGTOT as number]);
    const satFat = parseNevoNumber(fields[map.nutrients.FASAT as number]);
    const sodium = parseNevoNumber(fields[map.nutrients.NA as number]);
    const alcohol = parseNevoNumber(fields[map.nutrients.ALC as number]);

    rows.push({
      code: codeNum,
      nameNl,
      nameEn,
      synonyms,
      group,
      unit,
      kcal: round1(kcal),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      fiber: fiber !== null ? round1(fiber) : null,
      sugar: sugar !== null ? round1(sugar) : null,
      satFat: satFat !== null ? round1(satFat) : null,
      sodium: sodium !== null ? round1(sodium) : null,
      alcohol: alcohol !== null ? round1(alcohol) : null,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Output file assembly
// ---------------------------------------------------------------------------

const SOURCE_LABEL = 'RIVM NEVO-online 2023';
const ATTRIBUTION = 'NEVO-online versie 2023/8.0, RIVM, Bilthoven';

function toTuple(r: NevoRow_Internal): NevoRow {
  return [
    r.code,
    r.nameNl,
    r.nameEn,
    r.synonyms,
    r.group,
    r.unit,
    r.kcal,
    r.protein,
    r.carbs,
    r.fat,
    r.fiber,
    r.sugar,
    r.satFat,
    r.sodium,
    r.alcohol,
  ];
}

/** Build the NevoFile object (header + row tuples) from parsed rows. */
export function buildNevoFile(rows: NevoRow_Internal[], sourceFileName?: string): NevoFile {
  return {
    header: {
      version: 'NEVO2023',
      source: sourceFileName ? `${SOURCE_LABEL} (${sourceFileName})` : SOURCE_LABEL,
      attribution: ATTRIBUTION,
      count: rows.length,
    },
    rows: rows.map(toTuple),
  };
}

function buildEmptyNevoFile(): NevoFile {
  return {
    header: {
      version: 'none',
      source: SOURCE_LABEL,
      attribution: ATTRIBUTION,
      count: 0,
    },
    rows: [],
  };
}

function writeNevoJson(file: NevoFile, outPath: string): void {
  mkdirSync(path.dirname(outPath), { recursive: true });
  const rowsJson = file.rows.map((r) => JSON.stringify(r)).join(',\n    ');
  const json =
    '{\n' +
    `  "header": ${JSON.stringify(file.header)},\n` +
    '  "rows": [\n' +
    (file.rows.length > 0 ? `    ${rowsJson}\n` : '') +
    '  ]\n' +
    '}\n';
  writeFileSync(outPath, json, 'utf-8');
}

function findNewestCsv(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const csvFiles = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (csvFiles.length === 0) return null;
  let newest = csvFiles[0] as string;
  let newestMtime = statSync(path.join(dir, newest)).mtimeMs;
  for (const f of csvFiles.slice(1)) {
    const mtime = statSync(path.join(dir, f)).mtimeMs;
    if (mtime > newestMtime) {
      newest = f;
      newestMtime = mtime;
    }
  }
  return path.join(dir, newest);
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

export function main(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const outPath = path.resolve(repoRoot, 'public/data/nevo.json');
  const rawDir = path.resolve(repoRoot, 'data/raw');

  const argPath = process.argv[2];

  let inputPath: string | null = null;

  if (argPath) {
    const resolved = path.resolve(argPath);
    if (!existsSync(resolved)) {
      console.error(`Error: input CSV not found at ${resolved}`);
      process.exit(1);
      return;
    }
    inputPath = resolved;
  } else {
    inputPath = findNewestCsv(rawDir);
  }

  if (!inputPath) {
    console.log('No NEVO CSV found in data/raw/.');
    console.log('');
    console.log('To build the real nutrient database:');
    console.log('  1. Download NEVO-online 2023 from https://www.rivm.nl/nevo (accept the licence).');
    console.log('  2. Save/export the CSV into data/raw/.');
    console.log('  3. Run `npm run nevo` again.');
    console.log('');
    const empty = buildEmptyNevoFile();
    writeNevoJson(empty, outPath);
    console.log(`Wrote empty ${outPath} (count: 0).`);
    return;
  }

  const buf = readFileSync(inputPath);
  const text = decodeBuffer(buf);
  const internalRows = parseNevoCsv(text);
  const file = buildNevoFile(internalRows, path.basename(inputPath));
  writeNevoJson(file, outPath);

  console.log(`Parsed ${internalRows.length} rows from ${path.basename(inputPath)}.`);
  console.log(`Wrote ${outPath}.`);
  console.log('');
  console.log('Sample:');
  for (const r of internalRows.slice(0, 3)) {
    console.log(`  ${r.nameNl} — kcal ${r.kcal}, P ${r.protein}, C ${r.carbs}, F ${r.fat}`);
  }
}

function isMainModule(): boolean {
  const thisFile = path.resolve(fileURLToPath(import.meta.url));
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  if (!invoked) return false;
  if (process.platform === 'win32') {
    return thisFile.toLowerCase() === invoked.toLowerCase();
  }
  return thisFile === invoked;
}

if (isMainModule()) {
  main();
}
