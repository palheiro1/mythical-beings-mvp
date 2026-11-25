import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const PUBLIC_ROOT = path.resolve(PROJECT_ROOT, 'public');
const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.json', '.ts', '.tsx']);
const PUBLIC_ASSET_BUDGET_BYTES = 12 * 1024 * 1024;

const listSourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [absolutePath] : [];
  });

const directorySize = (directory: string): number => readdirSync(directory, { withFileTypes: true })
  .reduce((total, entry) => {
    const absolutePath = path.join(directory, entry.name);
    return total + (entry.isDirectory() ? directorySize(absolutePath) : statSync(absolutePath).size);
  }, 0);

describe('static assets', () => {
  it('keeps every image and logo referenced by the application available', () => {
    const files = [
      ...listSourceFiles(path.resolve(PROJECT_ROOT, 'src')),
      path.resolve(PROJECT_ROOT, 'index.html'),
      path.resolve(PUBLIC_ROOT, '404.html'),
    ];
    const missingAssets: string[] = [];

    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      const assetReferences = contents.matchAll(/\/(?:images|logos)\/[^"'(),\s]+\.(?:jpg|png|svg|webp)/g);
      for (const match of assetReferences) {
        const reference = match[0];
        const absoluteAssetPath = path.resolve(PUBLIC_ROOT, reference.slice(1));
        if (!existsSync(absoluteAssetPath)) missingAssets.push(`${path.relative(PROJECT_ROOT, file)} -> ${reference}`);
      }
    }

    expect(missingAssets).toEqual([]);
  });

  it('keeps the complete public payload below the explicit 12 MiB budget', () => {
    expect(directorySize(PUBLIC_ROOT)).toBeLessThan(PUBLIC_ASSET_BUDGET_BYTES);
  });
});
