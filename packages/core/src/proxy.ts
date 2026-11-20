export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5' | 'direct';

export interface ProxyConfig {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  country: string;
  status: 'unchecked' | 'ok' | 'failed';
  latencyMs: number | null;
  lastCheckedAt: string | null;
  rotationUrl?: string;
}

export interface ParsedProxy {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  valid: boolean;
  error?: string;
}

const PROTO_RE = /^(https?|socks[45]):\/\//i;

export function parseProxy(raw: string): ParsedProxy {
  const value = raw.trim();
  if (!value) return { protocol: 'direct', host: '', port: 0, valid: true };
  const withScheme = PROTO_RE.test(value) ? value : `http://${value}`;
  try {
    const u = new URL(withScheme);
    const proto = u.protocol.replace(':', '').toLowerCase() as ProxyProtocol;
    if (!['http', 'https', 'socks4', 'socks5'].includes(proto)) throw new Error(`Unsupported protocol: ${proto}`);
    if (!u.hostname) throw new Error('Missing host');
    // A bare token like "nope" is not a proxy endpoint. Require an explicit
    // port, a dotted hostname, an IPv4 literal or localhost.
    const looksLikeHost = !!u.port || u.hostname.includes('.') || u.hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname);
    if (!looksLikeHost) throw new Error('Missing host or port');
    const port = u.port ? Number(u.port) : proto === 'https' ? 443 : proto.startsWith('socks') ? 1080 : 80;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    return {
      protocol: proto,
      host: u.hostname,
      port,
      ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
      valid: true,
    };
  } catch (e) {
    return { protocol: 'http', host: '', port: 0, valid: false, error: (e as Error).message };
  }
}

export function proxyUrl(p: Pick<ProxyConfig, 'protocol' | 'host' | 'port' | 'username' | 'password'>): string {
  if (p.protocol === 'direct' || !p.host) return 'direct://';
  const auth = p.username ? `${encodeURIComponent(p.username)}${p.password ? `:${encodeURIComponent(p.password)}` : ''}@` : '';
  return `${p.protocol}://${auth}${p.host}:${p.port}`;
}

/** Parse bulk "one proxy per line" input, tolerating host:port:user:pass form. */
export function parseProxyLines(input: string): ParsedProxy[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      if (PROTO_RE.test(line) || line.includes('://')) return parseProxy(line);
      const parts = line.split(':');
      if (parts.length === 2) return parseProxy(`http://${parts[0]}:${parts[1]}`);
      if (parts.length === 4) return parseProxy(`http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`);
      return { protocol: 'http' as const, host: '', port: 0, valid: false, error: 'Unrecognised proxy line' };
    });
}

/** Deterministic simulated check for the demo control plane. Real clients use the native proxy test. */
export function checkProxy(p: ProxyConfig): ProxyConfig {
  const seed = [...p.host].reduce((a, c) => a + c.charCodeAt(0), 0);
  const ok = p.protocol !== 'direct' && (seed % 11 !== 0);
  return {
    ...p,
    status: ok ? 'ok' : 'failed',
    latencyMs: ok ? 40 + (seed % 220) : null,
    lastCheckedAt: new Date().toISOString(),
    country: p.country || guessCountry(seed),
  };
}

const COUNTRIES = ['US', 'DE', 'GB', 'BD', 'SG', 'NL', 'FR', 'CA', 'IN', 'AE'];
function guessCountry(seed: number): string { return COUNTRIES[seed % COUNTRIES.length]; }

export function guessProxyCountry(host: string): string {
  if (!host.trim()) return 'XX';
  const seed = [...host.trim()].reduce((a, c) => a + c.charCodeAt(0), 0);
  return guessCountry(seed);
}

/**
 * Smart clipboard parser for proxy strings. Accepts:
 * - proto://user:pass@host:port
 * - user:pass@host:port
 * - host:port:user:pass
 * - user:pass:host:port
 * - host:port
 */
export function smartParseProxy(raw: string): ParsedProxy & { countryHint: string; nameHint: string } {
  const value = raw.trim().split(/\r?\n/)[0]?.trim() ?? '';
  if (!value) return { protocol: 'socks5', host: '', port: 0, valid: false, error: 'Empty', countryHint: 'US', nameHint: '' };
  let parsed: ParsedProxy;
  if (PROTO_RE.test(value) || value.includes('://')) {
    parsed = parseProxy(value);
  } else if (value.includes('@')) {
    const portHint = Number(value.split(':').pop() || 0);
    const inferred: ProxyProtocol = portHint === 1080 || portHint === 1081 ? 'socks5' : portHint === 443 ? 'https' : 'http';
    parsed = parseProxy(`${inferred}://${value}`);
  } else {
    const parts = value.split(':');
    if (parts.length === 2) {
      const portNum = Number(parts[1]);
      const inferred: ProxyProtocol = portNum === 1080 || portNum === 1081 ? 'socks5' : portNum === 443 ? 'https' : 'http';
      parsed = parseProxy(`${inferred}://${parts[0]}:${parts[1]}`);
    } else if (parts.length === 4) {
      const hostFirst = /^\d{1,3}(\.\d{1,3}){3}$/.test(parts[0]) || parts[0].includes('.');
      const host = hostFirst ? parts[0] : parts[2];
      const port = hostFirst ? parts[1] : parts[3];
      const user = hostFirst ? parts[2] : parts[0];
      const pass = hostFirst ? parts[3] : parts[1];
      const portNum = Number(port);
      const inferred: ProxyProtocol = portNum === 1080 || portNum === 1081 ? 'socks5' : portNum === 443 ? 'https' : 'http';
      parsed = parseProxy(`${inferred}://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`);
    } else {
      parsed = parseProxy(value);
    }
  }
  const countryHint = parsed.host ? guessProxyCountry(parsed.host) : 'US';
  const nameHint = parsed.host ? `${countryHint} · ${parsed.host}` : '';
  return { ...parsed, countryHint, nameHint };
}

/** Plain ISO codes render identically everywhere — flag emoji need an emoji font. */
export function countryCode(country: string): string {
  const c = (country ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : 'XX';
}
