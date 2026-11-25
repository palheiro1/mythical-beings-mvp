import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  expectedNodeEngine,
  expectedNvmVersion,
  isSupportedNodeVersion,
} from './runtime-policy.mjs';

const projectFile = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const [packageJson, nvmVersion, workflow] = await Promise.all([
  readFile(projectFile('package.json'), 'utf8').then(JSON.parse),
  readFile(projectFile('.nvmrc'), 'utf8').then((value) => value.trim()),
  readFile(projectFile('.github/workflows/ci.yml'), 'utf8'),
]);

const findings = [];

if (!isSupportedNodeVersion(process.versions.node)) {
  findings.push(
    `Node ${process.versions.node} is unsupported; use Node 22.13+ or 24.x (run \`nvm install && nvm use\`).`,
  );
}
if (packageJson.engines?.node !== expectedNodeEngine) {
  findings.push(`package.json engines.node must be ${expectedNodeEngine}.`);
}
if (nvmVersion !== expectedNvmVersion) {
  findings.push(`.nvmrc must pin ${expectedNvmVersion}, found ${nvmVersion || '<empty>'}.`);
}
if (!workflow.includes('node-version-file: .nvmrc')) {
  findings.push('CI must load Node from .nvmrc.');
}

if (findings.length > 0) {
  process.stderr.write('Runtime policy failed:\n');
  for (const finding of findings) process.stderr.write(`- ${finding}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Runtime policy verified: Node ${process.versions.node}; .nvmrc ${expectedNvmVersion}; CI aligned.\n`,
  );
}
