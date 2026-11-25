import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global main landmark', () => {
  it('provides one route-independent skip target without nested page mains', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const home = readFileSync(resolve(process.cwd(), 'src/pages/Home.tsx'), 'utf8');
    const ui = readFileSync(resolve(process.cwd(), 'src/components/ui/index.tsx'), 'utf8');

    expect(app).toContain('<main id="main-content" tabIndex={-1}>');
    expect(app).toContain('href="#main-content"');
    expect(home).not.toContain('<main');
    expect(ui.slice(ui.indexOf('export function PageShell'), ui.indexOf('type ButtonVariant'))).not.toContain('<main');
  });
});
