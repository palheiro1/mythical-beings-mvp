import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isForbiddenPublicFile, scanPublicText } from './public-artifact-policy.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const artifactRoot = resolve(projectRoot, 'dist');
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
]);

const extensionOf = (filePath) => {
  const basename = filePath.split('/').at(-1) ?? '';
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex === -1 ? '' : basename.slice(dotIndex).toLowerCase();
};

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      files.push({ absolutePath, symbolicLink: true });
    } else if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push({ absolutePath, symbolicLink: false });
    }
  }

  return files;
};

let files;
try {
  files = await collectFiles(artifactRoot);
} catch (error) {
  process.stderr.write(`Public artifact verification could not read dist/: ${error.message}\n`);
  process.exitCode = 1;
  files = [];
}

const findings = [];
let scannedTextFiles = 0;

for (const file of files) {
  const relativePath = relative(artifactRoot, file.absolutePath).replaceAll('\\', '/');
  if (file.symbolicLink) {
    findings.push({ relativePath, kind: 'symbolic_link' });
    continue;
  }
  if (isForbiddenPublicFile(relativePath)) {
    findings.push({ relativePath, kind: 'forbidden_file' });
    continue;
  }
  if (!textExtensions.has(extensionOf(relativePath))) continue;

  const text = await readFile(file.absolutePath, 'utf8');
  scannedTextFiles += 1;
  findings.push(...scanPublicText(relativePath, text));
}

if (files.length === 0 && process.exitCode !== 1) {
  findings.push({ relativePath: '.', kind: 'empty_artifact' });
}

if (findings.length > 0) {
  process.stderr.write('Public artifact policy failed:\n');
  for (const finding of findings) {
    process.stderr.write(`- ${finding.relativePath}: ${finding.kind}\n`);
  }
  process.exitCode = 1;
} else if (process.exitCode !== 1) {
  process.stdout.write(
    `Public artifact verified: ${files.length} files, ${scannedTextFiles} text files scanned, no privileged material or sourcemaps.\n`,
  );
}
