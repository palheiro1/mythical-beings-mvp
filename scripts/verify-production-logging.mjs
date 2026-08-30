import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const assetsDirectory = new URL('../dist/assets/', import.meta.url);
const files = readdirSync(assetsDirectory)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, source: readFileSync(new URL(file, assetsDirectory), 'utf8') }));

const firstPartyFiles = files.filter(({ file }) => !basename(file).startsWith('vendor-'));
const forbiddenSyntax = [
  { label: 'console call/reference', pattern: /\bconsole\s*\./ },
  { label: 'debugger statement', pattern: /\bdebugger\b/ },
];
const sensitiveDiagnostics = [
  'INITIALIZE_GAME completed',
  'Current game state',
  'Raw realtime payload',
  'Fetched player profiles',
];

const failures = [];
for (const { file, source } of firstPartyFiles) {
  for (const check of forbiddenSyntax) {
    if (check.pattern.test(source)) failures.push(`${file}: ${check.label}`);
  }
}
for (const { file, source } of files) {
  for (const diagnostic of sensitiveDiagnostics) {
    if (source.includes(diagnostic)) failures.push(`${file}: sensitive diagnostic "${diagnostic}"`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Production logging verification failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Production logging verification passed for ${firstPartyFiles.length} first-party chunks.\n`);
