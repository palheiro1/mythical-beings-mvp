import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  bundleBudgets,
  evaluateBundleMeasurements,
  findForbiddenInitialJavaScript,
} from './bundle-budget-policy.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const artifactRoot = resolve(projectRoot, 'dist');
const indexPath = resolve(artifactRoot, 'index.html');

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;
const localAssetPath = (publicPath) => {
  if (!publicPath.startsWith('/assets/') || publicPath.includes('..')) {
    throw new Error(`unexpected build asset path ${publicPath}`);
  }

  const absolutePath = resolve(artifactRoot, publicPath.slice(1));
  if (relative(artifactRoot, absolutePath).startsWith('..')) {
    throw new Error(`asset escapes dist/: ${publicPath}`);
  }
  return absolutePath;
};

const gzipBytes = async (publicPath) => gzipSync(await readFile(localAssetPath(publicPath))).byteLength;

let indexHtml;
try {
  indexHtml = await readFile(indexPath, 'utf8');
} catch (error) {
  process.stderr.write(`Bundle budget verification could not read dist/index.html: ${error.message}\n`);
  process.exitCode = 1;
}

if (indexHtml) {
  try {
    const entryScripts = [...indexHtml.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["'][^>]*>/g)]
      .map((match) => match[1]);
    const modulePreloads = [...indexHtml.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+\.js)["'][^>]*>/g)]
      .map((match) => match[1]);
    const stylesheets = [...indexHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["'][^>]*>/g)]
      .map((match) => match[1]);
    const initialJavaScript = [...new Set([...entryScripts, ...modulePreloads])];
    const initialCss = [...new Set(stylesheets)];

    const initialJavaScriptSizes = await Promise.all(initialJavaScript.map(gzipBytes));
    const initialCssSizes = await Promise.all(initialCss.map(gzipBytes));
    const allJavaScriptFiles = (await readdir(resolve(artifactRoot, 'assets')))
      .filter((file) => file.endsWith('.js'))
      .map((file) => `/assets/${file}`);
    const allJavaScriptSizes = await Promise.all(allJavaScriptFiles.map(gzipBytes));

    const measurements = {
      initialJavaScriptGzipBytes: initialJavaScriptSizes.reduce((sum, bytes) => sum + bytes, 0),
      largestJavaScriptChunkGzipBytes: Math.max(0, ...allJavaScriptSizes),
      initialCssGzipBytes: initialCssSizes.reduce((sum, bytes) => sum + bytes, 0),
      initialJavaScriptFiles: initialJavaScript.length,
      initialCssFiles: initialCss.length,
    };
    const findings = evaluateBundleMeasurements(measurements);
    const forbiddenInitialJavaScript = findForbiddenInitialJavaScript(initialJavaScript);

    if (findings.length > 0 || forbiddenInitialJavaScript.length > 0) {
      process.stderr.write('Bundle budget failed:\n');
      for (const finding of findings) {
        const valuesAreBytes = finding.metric !== 'initial_javascript_files'
          && finding.metric !== 'initial_css_files';
        const actual = valuesAreBytes ? formatKiB(finding.actual) : String(finding.actual);
        const expected = valuesAreBytes ? formatKiB(finding.expected) : String(finding.expected);
        process.stderr.write(`- ${finding.metric}: ${actual}; budget ${expected}\n`);
      }
      for (const publicPath of forbiddenInitialJavaScript) {
        process.stderr.write(`- forbidden_initial_javascript: ${publicPath}\n`);
      }
      process.exitCode = 1;
    } else {
      process.stdout.write(
        `Bundle budget verified: initial JS ${formatKiB(measurements.initialJavaScriptGzipBytes)} `
        + `across ${measurements.initialJavaScriptFiles} files; largest JS chunk `
        + `${formatKiB(measurements.largestJavaScriptChunkGzipBytes)}; initial CSS `
        + `${formatKiB(measurements.initialCssGzipBytes)}.\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`Bundle budget verification failed to inspect dist/: ${error.message}\n`);
    process.exitCode = 1;
  }
}
