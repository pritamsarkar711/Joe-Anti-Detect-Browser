/**
 * Static checks on the Supabase migrations and the client secret surface.
 *
 * These are not a replacement for running the SQL: this sandbox has no Postgres
 * and no project credentials, so execution is verified in CI/manually (see
 * docs/VALIDATION.md). What they do guarantee is that the properties the app
 * depends on cannot be edited away silently — a missing RLS statement, a
 * permissive policy, a definer function left executable by `public`, or a
 * service-role key pasted into the client all fail here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_DIR = join(process.cwd(), 'supabase', 'migrations');
const migrations = readdirSync(MIGRATION_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const schema = migrations.map((f) => readFileSync(join(MIGRATION_DIR, f), 'utf8')).join('\n');

function sqlBody(text: string): string {
  // Strip line comments so assertions cannot be satisfied by a comment.
  return text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const sql = sqlBody(schema);

function tablesCreatedIn(text: string): string[] {
  return [...text.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1].toLowerCase());
}

describe('database schema', () => {
  it('ships the migrations in order', () => {
    // 0002_accounts_and_licensing is the migration applied to the live
    // project (version 20261119181923). A competing 0002_entitlements from a
    // parallel branch was removed in the integration merge — never re-add a
    // second 0002: entitlements now come from public.accounts alone.
    expect(migrations).toEqual(['0001_joe_browser_init.sql', '0002_accounts_and_licensing.sql']);
  });

  it('enables row level security on every table it creates', () => {
    const publicTables = tablesCreatedIn(sql);
    expect(publicTables.length).toBeGreaterThanOrEqual(9);
    for (const table of publicTables) {
      const enabled = new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(sql);
      expect(enabled, `RLS missing on public.${table}`).toBe(true);
    }
    // The licensing tables live in joe_private and are deny-by-default too.
    for (const table of ['accounts', 'admins', 'codes']) {
      const enabled = new RegExp(`alter table joe_private\\.${table} enable row level security`, 'i').test(sql);
      expect(enabled, `RLS missing on joe_private.${table}`).toBe(true);
    }
  });

  it('contains no permissive policy or anonymous grant', () => {
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/to\s+anon\b/i);
    expect(sql).not.toMatch(/for all to public/i);
  });

  it('scopes every policy to a membership check or the caller id', () => {
    // Static policies (quoted names contain spaces and colons, e.g.
    // "accounts: read own")…
    const staticPolicies = [...sql.matchAll(
      /create policy\s+"?([\w :.-]+)"?\s+on\s+public\.(\w+)\s+for\s+(\w+)(?:\s+to\s+(\w+))?\s+([\s\S]*?);/gi,
    )].map(([, name, table, _verb, _to, body]) => ({ name: name.trim(), table, body }));

    // …and the five tables 0001 covers with `execute format(...)`, which is
    // where the actual tenant isolation for profiles/proxies/devices/commands/
    // events lives. A regex over plain statements would have skipped it.
    const dynamic = /execute format\(\$f\$\s*create policy %I on public\.%I for all to authenticated\s*using \(([\s\S]*?)\)\s*with check \(([\s\S]*?)\)/i.exec(sql);
    expect(dynamic, 'the dynamic workspace policy template is missing').not.toBeNull();
    const dynamicBody = `${dynamic?.[1]} ${dynamic?.[2]}`;
    for (const table of ['profiles', 'proxies', 'devices', 'commands', 'events']) {
      expect(sql).toContain(`'${table}'`);
    }

    expect(staticPolicies.length).toBeGreaterThanOrEqual(4);
    for (const { name, table, body } of staticPolicies) {
      const scoped =
        /workspace_members/.test(body) ||
        /user_id\s*=\s*auth\.uid\(\)/.test(body) ||
        /auth\.uid\(\)\s*=\s*id/.test(body);
      expect(scoped, `policy ${name} on ${table} is not scoped to the caller`).toBe(true);
    }
    expect(dynamicBody).toMatch(/workspace_members/);
    expect(dynamicBody).toMatch(/m\.user_id\s*=\s*auth\.uid\(\)/);
  });

  it('keeps the allowlist and the plan columns unwritable by users', () => {
    // The allowlist decides who is premium/owner: no user policy at all, and
    // the explicit revoke covers Supabase's default table grants.
    const allowlistWrites = /create policy[^;]*on public\.account_allowlist/i.test(sql);
    expect(allowlistWrites, 'account_allowlist must have no user policy').toBe(false);
    expect(sql).toMatch(/revoke all on public\.account_allowlist from anon, authenticated/i);

    // accounts rows are created only by the SECURITY DEFINER signup trigger:
    // no INSERT/DELETE policy, and the UPDATE trigger freezes plan + limit so
    // `guard_account_plan` makes self-serve escalation impossible.
    const accountInsert = /create policy[^;]*on public\.accounts[^;]*for (insert|delete|all)/i.test(sql);
    expect(accountInsert, 'accounts must have no insert/delete policy').toBe(false);
    expect(sql).toMatch(/create policy "accounts: read own" on public\.accounts\s+for select to authenticated using \(auth\.uid\(\) = id\)/i);
    expect(sql).toMatch(/create trigger guard_account_plan_before_update/i);
    expect(sql).toMatch(/new\.plan\s*:=\s*old\.plan/i);
    expect(sql).toMatch(/new\.profile_limit\s*:=\s*old\.profile_limit/i);
  });

  it('exposes privileged work only through SECURITY DEFINER functions', () => {
    for (const fn of ['handle_new_account', 'require_user', 'require_admin', 'msap_my_entitlement']) {
      const pattern = new RegExp(`create or replace function (?:public|joe_private)\\.${fn}\\([^)]*\\)[\\s\\S]*?security definer`, 'i');
      expect(pattern.test(sql), `${fn} must be SECURITY DEFINER`).toBe(true);
    }
    // joe_private itself grants nothing to the API roles: the licensing RPCs
    // are the only way in, and each defends itself with require_*().
    expect(sql).not.toMatch(/grant\s+[\w\s,]+\s+on\s+(?:schema\s+)?joe_private/i);
  });

  it('fails closed for a new or unknown account', () => {
    // New signups land on free unless the allowlist says otherwise…
    expect(sql).toMatch(/plan text not null default 'free'/i);
    // …the backfill reads the allowlist for pre-trigger users…
    expect(sql).toMatch(/insert into public\.accounts[\s\S]*?from auth\.users u/i);
    // …and the trigger that creates rows is attached to auth.users.
    expect(sql).toMatch(/create trigger \w+\s+after insert on auth\.users/i);
    // Client-side fail-closed parsing (a missing limit is never "unlimited")
    // lives in cloud.ts and is covered by tests/cloud.test.ts.
  });

  it('locks the relay table away from anonymous callers', () => {
    // The desktop/Android relay speaks to the joe-command-validate edge
    // function; the anon role must hold no policy on commands at all.
    const anonPolicy = /create policy[^;]*on public\.commands[^;]*to anon/i.test(sql);
    expect(anonPolicy, 'commands must have no anon policy').toBe(false);
    expect(sql).not.toMatch(/to\s+anon\b/i);
    // Authenticated workspace members keep the original workspace-scoped
    // policy from 0001 — scoped, never open.
    const dynamic = /execute format\(\$f\$\s*create policy %I on public\.%I for all to authenticated/i.test(sql);
    expect(dynamic).toBe(true);
  });
});

describe('client secret surface', () => {
  const ROOT = process.cwd();
  const SCAN_DIRS = ['src', 'packages', 'apps/desktop', 'apps/android/app/src'];
  const SKIP = /node_modules|core\.cjs|web-dist|\.map$/;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (SKIP.test(full)) continue;
      const info = statSync(full);
      if (info.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|js|cjs|mjs|java|xml|json)$/.test(entry)) out.push(full);
    }
    return out;
  }

  const files = SCAN_DIRS.flatMap((d) => {
    try { return walk(join(ROOT, d)); } catch { return []; }
  });

  it('scans a meaningful number of client files', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('contains no service-role key or private credential', () => {
    // A service-role JWT, a Supabase secret key, an AWS key, a private key block.
    const patterns: Array<[string, RegExp]> = [
      ['service-role JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*"role"\s*:\s*"service_role/],
      ['supabase secret key', /sb_secret_[A-Za-z0-9_-]{10,}/],
      ['AWS access key', /AKIA[0-9A-Z]{16}/],
      ['private key block', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
      ['hard-coded password', /(password|passwd)\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const [label, re] of patterns) {
        if (re.test(text)) {
          // The Android keystore passphrase is a local debug-signing constant,
          // generated inside the build workspace; flag anything else.
          if (label === 'hard-coded password' && /build-apk\.sh|joebrowser/.test(file)) continue;
          offenders.push(`${file.replace(ROOT, '')}: ${label}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
