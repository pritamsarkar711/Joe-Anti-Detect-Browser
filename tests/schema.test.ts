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
    expect(migrations).toEqual(['0001_joe_browser_init.sql', '0002_entitlements.sql']);
  });

  it('enables row level security on every table it creates', () => {
    const tables = tablesCreatedIn(sql);
    expect(tables.length).toBeGreaterThanOrEqual(9);
    for (const table of tables) {
      const enabled = new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(sql);
      expect(enabled, `RLS missing on ${table}`).toBe(true);
    }
  });

  it('contains no permissive policy or anonymous grant', () => {
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/to\s+anon\b/i);
    expect(sql).not.toMatch(/for all to public/i);
  });

  it('scopes every workspace policy to a membership check or the caller id', () => {
    // Static policies…
    const staticPolicies = [...sql.matchAll(
      /create policy (\w+) on public\.(\w+)\s+for \w+(?: to \w+)? using \(([\s\S]*?)\)(?:\s+with check \(([\s\S]*?)\))?;/gi,
    )].map(([, name, table, using, check]) => ({ name, table, body: `${using} ${check ?? ''}` }));

    // …and the five tables 0001 covers with `execute format(...)`, which is where
    // the actual tenant isolation for profiles/proxies/devices/commands/events
    // lives. A regex over plain statements would have silently skipped it.
    const dynamic = /execute format\(\$f\$\s*create policy %I on public\.%I for all to authenticated\s*using \(([\s\S]*?)\)\s*with check \(([\s\S]*?)\)/i.exec(sql);
    expect(dynamic, 'the dynamic workspace policy template is missing').not.toBeNull();
    const dynamicBody = `${dynamic?.[1]} ${dynamic?.[2]}`;
    for (const table of ['profiles', 'proxies', 'devices', 'commands', 'events']) {
      expect(sql).toContain(`'${table}'`);
    }

    expect(staticPolicies.length).toBeGreaterThanOrEqual(3);
    for (const { name, table, body } of staticPolicies) {
      const scoped = /workspace_members/.test(body) || /user_id\s*=\s*auth\.uid\(\)/.test(body);
      expect(scoped, `policy ${name} on ${table} is not scoped to the caller`).toBe(true);
    }
    expect(dynamicBody).toMatch(/workspace_members/);
    expect(dynamicBody).toMatch(/m\.user_id\s*=\s*auth\.uid\(\)/);
  });

  it('keeps the plan and the admin roster unwritable by users', () => {
    const entitlementWrites = /create policy[^;]*on public\.entitlements[^;]*for (insert|update|delete|all)/i.test(sql);
    const adminWrites = /create policy[^;]*on public\.app_admins/i.test(sql);
    expect(entitlementWrites, 'entitlements must be read-only for users').toBe(false);
    expect(adminWrites, 'app_admins must have no user policy').toBe(false);
    expect(sql).toMatch(/create policy entitlements_select on public\.entitlements\s+for select to authenticated using \(user_id = auth\.uid\(\)\)/i);
  });

  it('exposes the plan through a SECURITY DEFINER function only', () => {
    for (const fn of ['my_entitlement', 'is_admin', 'enforce_profile_quota', 'ensure_user_workspace', 'my_workspace_id']) {
      const pattern = new RegExp(`create or replace function public\\.${fn}\\([^)]*\\)[\\s\\S]*?security definer`, 'i');
      expect(pattern.test(sql), `${fn} must be SECURITY DEFINER`).toBe(true);
    }
    for (const fn of ['my_entitlement()', 'is_admin()', 'my_workspace_id()']) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn.replace('(', '\\(').replace(')', '\\)')} from public`, 'i'));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn.replace('(', '\\(').replace(')', '\\)')} to authenticated`, 'i'));
    }
  });

  it('fails closed for an anonymous caller', () => {
    expect(sql).toMatch(/'verified', false/i);
    expect(sql).toMatch(/'profile_limit', 2/i);
  });

  it('enforces the quota with a trigger, not a UI hint', () => {
    expect(sql).toMatch(/create trigger profiles_quota\s+before insert on public\.profiles\s+for each row execute function public\.enforce_profile_quota\(\)/i);
    expect(sql).toMatch(/raise exception 'profile quota reached/i);
    expect(sql).toMatch(/auth\.role\(\)[^)]*\) = 'service_role'/i);
  });

  it('creates a workspace for every new auth user', () => {
    expect(sql).toMatch(/create trigger joe_bootstrap_workspace\s+after insert on auth\.users/i);
    expect(sql).toMatch(/insert into public\.workspace_members \(workspace_id, user_id, role\)\s+values \(wid, uid, 'owner'\)/i);
  });

  it('scopes primary keys to the workspace so deterministic ids cannot collide', () => {
    for (const table of ['profiles', 'proxies', 'devices', 'commands']) {
      const re = new RegExp(`alter table public\\.${table} add constraint ${table}_pkey primary key \\(workspace_id, id\\)`, 'i');
      expect(re.test(sql), `${table} primary key must be (workspace_id, id)`).toBe(true);
    }
    const profilesProxy = /alter table public\.profiles\s+add constraint profiles_proxy_fk foreign key \(workspace_id, proxy_id\)\s+references public\.proxies \(workspace_id, id\)/i;
    expect(profilesProxy.test(sql)).toBe(true);
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
