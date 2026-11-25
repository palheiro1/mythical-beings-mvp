import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PREFLIGHT_PATH = resolve(
  process.cwd(),
  'docs/tech/supabase_authoritative_preflight.readonly.sql',
);

const stripLineComments = (sql: string) => sql
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

describe('Supabase authoritative reconciliation proposal', () => {
  it('keeps the preflight script transactionally and lexically read-only', () => {
    const sql = stripLineComments(readFileSync(PREFLIGHT_PATH, 'utf8'));

    expect(sql).toMatch(/begin\s+transaction\s+read\s+only\s*;/i);
    expect(sql.trim()).toMatch(/rollback\s*;$/i);
    expect(sql).not.toMatch(
      /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|do|copy|vacuum|analyze)\b/i,
    );
  });

  it('does not add a deployable migration for the unreviewed design', () => {
    const proposal = readFileSync(
      resolve(
        process.cwd(),
        'docs/tech/SUPABASE_AUTHORITATIVE_RECONCILIATION_PROPOSAL_2026-08-28.md',
      ),
      'utf8',
    );

    expect(proposal).toContain('não é migração executável');
    expect(proposal).toContain('branch Supabase isolada');
    expect(proposal).toContain('Rollback forward-only');
  });
});

