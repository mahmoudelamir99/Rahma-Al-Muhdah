import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const rootDir = process.cwd();

const includedExtensions = new Set(['.html', '.js', '.json', '.md', '.ts', '.tsx']);
const excludedDirNames = new Set([
  'node_modules',
  'dist',
  '.git',
  '.codex-temp',
  'stitch',
  'stitch_',
  'stitch_companies_management_system',
  '__pycache__',
]);
const excludedRelativePaths = new Set([
  'site.js',
  'al-rahma-recruitment-admin\\src\\lib\\admin-store.tsx',
  'al-rahma-recruitment-admin\\src\\lib\\admin-dashboard.ts',
  'scripts\\repair-mojibake.mjs',
]);

const legacyMojibakePattern =
  /[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a\u06af\u06ba\u06be\u0679\u067e\u0686\u0691]/;
const legacyMojibakeFragmentPattern =
  /(?:(?:ط|ظ)[\u0600-\u06ff]){2,}|[\u00a1-\u00bf\u0192\u0152\u0153\u0161\u0178\u017e\u02c6\u200c\u201a\u201e\u2020\u2021\u2026\u2030\u2039\u203a]{2,}/g;

let cp1256EncodingMap = null;

function countLegacyMojibakeChars(value) {
  return Array.from(String(value ?? '')).reduce(
    (total, character) => total + Number(legacyMojibakePattern.test(character)),
    0,
  );
}

function countLegacyMojibakePairs(value) {
  return (String(value ?? '').match(/(?:ط·[ط§ط£ط¥ط¢ط،-ظٹ]|ط¸[ط§ط£ط¥ط¢ط،-ظٹ])/g) || []).length;
}

function getLegacySignalScore(value) {
  return countLegacyMojibakeChars(value) * 3 + countLegacyMojibakePairs(value);
}

function shouldAttemptLegacyDecode(value) {
  const rawValue = String(value ?? '');
  return legacyMojibakePattern.test(rawValue) || countLegacyMojibakePairs(rawValue) >= 2;
}

function getCp1256EncodingMap() {
  if (cp1256EncodingMap) return cp1256EncodingMap;

  try {
    const decoder = new TextDecoder('windows-1256', { fatal: false });
    const nextMap = new Map();

    for (let byte = 0; byte <= 255; byte += 1) {
      const character = decoder.decode(new Uint8Array([byte]));
      if (character && character !== '\uFFFD' && !nextMap.has(character)) {
        nextMap.set(character, byte);
      }
    }

    cp1256EncodingMap = nextMap;
  } catch {
    cp1256EncodingMap = new Map();
  }

  return cp1256EncodingMap;
}

function decodeLegacyMojibakeCandidate(value, encoderMap) {
  const rawValue = String(value ?? '');
  if (!shouldAttemptLegacyDecode(rawValue) || !encoderMap.size) return rawValue;

  const bytes = [];

  for (const character of rawValue) {
    const codePoint = character.charCodeAt(0);
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
      continue;
    }

    const mappedByte = encoderMap.get(character);
    if (mappedByte === undefined) {
      return rawValue;
    }
    bytes.push(mappedByte);
  }

  try {
    const fixedValue = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return getLegacySignalScore(fixedValue) < getLegacySignalScore(rawValue) ? fixedValue : rawValue;
  } catch {
    return rawValue;
  }
}

function repairLegacyMojibakeFragments(value, encoderMap) {
  return String(value ?? '').replace(legacyMojibakeFragmentPattern, (fragment) =>
    decodeLegacyMojibakeCandidate(fragment, encoderMap),
  );
}

function repairLegacyMojibakeText(value) {
  const rawValue = String(value ?? '');
  if (!shouldAttemptLegacyDecode(rawValue)) return rawValue;

  const encoderMap = getCp1256EncodingMap();
  if (!encoderMap.size) return rawValue;

  let bestValue = rawValue;
  let bestScore = getLegacySignalScore(rawValue);

  const considerCandidate = (candidate) => {
    if (typeof candidate !== 'string' || candidate === bestValue) return;

    const candidateScore = getLegacySignalScore(candidate);
    if (candidateScore < bestScore) {
      bestValue = candidate;
      bestScore = candidateScore;
    }
  };

  considerCandidate(decodeLegacyMojibakeCandidate(rawValue, encoderMap));
  considerCandidate(
    rawValue
      .split(/(\s+)/)
      .map((segment) => (/^\s+$/.test(segment) ? segment : decodeLegacyMojibakeCandidate(segment, encoderMap)))
      .join(''),
  );
  considerCandidate(repairLegacyMojibakeFragments(rawValue, encoderMap));

  return bestValue;
}

function walk(directoryPath, collected = []) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (excludedDirNames.has(entry.name)) continue;

    const absolutePath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, collected);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!includedExtensions.has(extname(entry.name).toLowerCase())) continue;

    const relativePath = relative(rootDir, absolutePath);
    if (excludedRelativePaths.has(relativePath)) continue;
    collected.push(absolutePath);
  }

  return collected;
}

function repairJsonValue(value) {
  if (typeof value === 'string') {
    return repairLegacyMojibakeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => repairJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairJsonValue(entry)]),
    );
  }

  return value;
}

function repairQuotedLiterals(line) {
  const repairSingleQuoted = (input) =>
    input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, content) => {
      const repaired = repairLegacyMojibakeText(content);
      return repaired === content ? match : `'${repaired}'`;
    });

  const repairDoubleQuoted = (input) =>
    input.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, content) => {
      const repaired = repairLegacyMojibakeText(content);
      return repaired === content ? match : `"${repaired}"`;
    });

  return repairDoubleQuoted(repairSingleQuoted(line));
}

const changedFiles = [];

for (const filePath of walk(rootDir)) {
  const relativePath = relative(rootDir, filePath);
  const original = readFileSync(filePath, 'utf8');
  let repaired = original;

  if (extname(filePath).toLowerCase() === '.json') {
    const parsed = JSON.parse(original);
    repaired = `${JSON.stringify(repairJsonValue(parsed), null, 2)}${original.endsWith('\n') ? '\n' : ''}`;
  } else if (['.ts', '.tsx', '.js'].includes(extname(filePath).toLowerCase())) {
    repaired = original
      .split(/\r?\n/)
      .map((line) => repairQuotedLiterals(line))
      .join(original.includes('\r\n') ? '\r\n' : '\n');
  } else {
    repaired = original
      .split(/\r?\n/)
      .map((line) => repairLegacyMojibakeText(line))
      .join(original.includes('\r\n') ? '\r\n' : '\n');
  }

  if (repaired !== original) {
    writeFileSync(filePath, repaired, 'utf8');
    changedFiles.push(relativePath);
  }
}

console.log(`Repaired ${changedFiles.length} files.`);
changedFiles.forEach((filePath) => console.log(filePath));
