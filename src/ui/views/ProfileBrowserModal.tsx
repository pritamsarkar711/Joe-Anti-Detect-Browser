import { useEffect, useMemo, useState } from 'react';
import {
  Box, Dialog, DialogContent, Divider, IconButton, Paper, Stack, Tab, Tabs, TextField,
  Typography, Chip, Button,
} from '@mui/material';
import { useStore } from '@/state/store';
import { checkProfile, geoForCountry, profileBrowserLabel } from '@joe/core';
import { buildInjectionScript } from '@joe/fingerprint';
import { Icon } from '../Icons';
import { CountryFlag, Official } from '../Brand';
import { Btn, ScoreRing, Tag } from '../Primitives';

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  histIdx: number;
}

interface ProbeResult {
  passed: number;
  total: number;
  failures: string[];
  probe: Record<string, unknown>;
}

const QUICK_SITES = [
  { label: 'Local Probe', url: 'joe://probe' },
  { label: 'Pixelscan', url: 'https://pixelscan.net/' },
  { label: 'IP Fighter', url: 'https://ipfighter.com/' },
  { label: 'AmIUnique', url: 'https://amiunique.org/' },
  { label: 'CreepJS', url: 'https://abrahamjuliot.github.io/creepjs/' },
  { label: 'BrowserLeaks', url: 'https://browserleaks.com/' },
];

const osMark = (os: string) =>
  os === 'Windows' ? 'windows' : os === 'Android' ? 'android' : os === 'macOS' || os === 'iOS' || os === 'iPadOS' ? 'apple' : 'linux';

function normalizeUrlInput(raw: string): string {
  const s = raw.trim();
  if (!s) return 'joe://probe';
  if (s === 'joe://probe') return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(s)) return `https://${s}`;
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`;
}

function titleFromUrl(u: string): string {
  if (u === 'joe://probe') return 'Fingerprint Probe';
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

export function ProfileBrowserModal() {
  const s = useStore();
  const p = s.profiles.find((x) => x.id === s.previewProfileId) ?? null;

  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [addr, setAddr] = useState('joe://probe');
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [runNonce, setRunNonce] = useState(0);

  useEffect(() => {
    if (!p) {
      setTabs([]);
      setProbe(null);
      return;
    }
    const initial: BrowserTab = {
      id: 'tab_1',
      title: 'Fingerprint Probe',
      url: 'joe://probe',
      history: ['joe://probe'],
      histIdx: 0,
    };
    setTabs([initial]);
    setActiveId('tab_1');
    setAddr('joe://probe');
    setProbe(null);
    setRunNonce((n) => n + 1);
  }, [p?.id]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? null;

  useEffect(() => {
    if (activeTab) setAddr(activeTab.url);
  }, [activeTab?.id, activeTab?.url]);

  const token = useMemo(() => (p ? `${p.id}:${runNonce}` : ''), [p?.id, runNonce]);

  useEffect(() => {
    if (!p) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; token?: string; result?: ProbeResult };
      if (d?.source === 'joe-browser-probe' && d.token === token && d.result) {
        setProbe(d.result);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [p, token]);

  const probeDoc = useMemo(() => {
    if (!p || !activeTab || activeTab.url !== 'joe://probe') return '';
    const script = buildInjectionScript(p.fingerprint, { selfTestHook: true }).replace(/<\/script/gi, '<\\/script');
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${script}</script><script>try{var r=window.__joeVerify();parent.postMessage({source:'joe-browser-probe',token:${JSON.stringify(token)},result:r},'*')}catch(e){parent.postMessage({source:'joe-browser-probe',token:${JSON.stringify(token)},result:{passed:0,total:1,failures:[String(e)],probe:{}}},'*')}</script></body></html>`;
  }, [p, activeTab?.url, token]);

  if (!p || !activeTab) return null;

  const px = s.proxies.find((x) => x.id === p.proxyId);
  const geo = px ? geoForCountry(px.country) : null;
  const consistency = checkProfile(p);
  const isBookmarked = bookmarks.includes(activeTab.url);

  const navigate = (rawInput: string) => {
    const nextUrl = normalizeUrlInput(rawInput);
    const title = titleFromUrl(nextUrl);
    setTabs((prev) => prev.map((t) => {
      if (t.id !== activeTab.id) return t;
      const sliced = t.history.slice(0, t.histIdx + 1);
      const history = sliced[sliced.length - 1] === nextUrl ? sliced : [...sliced, nextUrl];
      return { ...t, url: nextUrl, title, history, histIdx: history.length - 1 };
    }));
    setAddr(nextUrl);
    if (nextUrl === 'joe://probe') {
      setProbe(null);
      setRunNonce((n) => n + 1);
    } else if (/^https?:/i.test(nextUrl)) {
      s.addHistory([{ profileId: p.id, profileName: p.name, url: nextUrl, title, search: nextUrl.includes('/search?q=') }]);
    }
  };

  const stepHistory = (delta: number) => {
    const nextIdx = activeTab.histIdx + delta;
    if (nextIdx < 0 || nextIdx >= activeTab.history.length) return;
    const nextUrl = activeTab.history[nextIdx];
    setTabs((prev) => prev.map((t) => (
      t.id === activeTab.id ? { ...t, url: nextUrl, title: titleFromUrl(nextUrl), histIdx: nextIdx } : t
    )));
    setAddr(nextUrl);
    if (nextUrl === 'joe://probe') {
      setProbe(null);
      setRunNonce((n) => n + 1);
    }
  };

  const addTab = () => {
    const id = `tab_${Date.now().toString(36)}`;
    const next: BrowserTab = { id, title: 'Fingerprint Probe', url: 'joe://probe', history: ['joe://probe'], histIdx: 0 };
    setTabs((prev) => [...prev, next]);
    setActiveId(id);
    setRunNonce((n) => n + 1);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) {
      s.setPreviewProfileId(null);
      return;
    }
    const idx = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeId === id) {
      const next = remaining[Math.max(0, idx - 1)];
      setActiveId(next.id);
    }
  };

  const toggleBookmark = () => {
    setBookmarks((prev) => prev.includes(activeTab.url) ? prev.filter((u) => u !== activeTab.url) : [activeTab.url, ...prev]);
    s.toast(isBookmarked ? 'Bookmark removed' : 'Page bookmarked');
  };

  const probeData = probe?.probe as Record<string, unknown> | undefined;
  const spec = p.fingerprint;
  const accepts = (spec.languages || [spec.locale]).map((l, i) => (i === 0 ? l : `${l};q=${Math.max(0.1, Number((1 - i * 0.1).toFixed(1)))}`)).join(',');
  const supportsCh = !/Firefox\//.test(spec.userAgent) && (/Chrome\//.test(spec.userAgent) || /EdgA?\//.test(spec.userAgent));

  return (
    <Dialog
      open
      onClose={() => s.setPreviewProfileId(null)}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: 960,
          width: '100%',
          height: { xs: '90dvh', md: '82dvh' },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Top window chrome: profile badge + session stop */}
      <Box sx={{ px: 1.5, py: 1, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}>
          <Official name={osMark(p.os)} size={16} color="#D81B60" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{p.name}</Typography>
          <Typography noWrap variant="caption" color="text.secondary">
            {profileBrowserLabel(p)} · {p.os} · {spec.screen.width}×{spec.screen.height}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {px ? (
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ px: 1, py: 0.35, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 1 }}>
            <CountryFlag code={px.country} size={14} title={geo?.name} />
            <Typography variant="caption" sx={{ fontWeight: 500 }}>{px.name}</Typography>
          </Stack>
        ) : (
          <Tag tone="neutral">Direct</Tag>
        )}
        <Btn size="small" variant="danger" icon="stop" onClick={() => s.setStatus([p.id], 'stopped')}>Stop</Btn>
        <IconButton size="small" aria-label="Minimize session" onClick={() => s.setPreviewProfileId(null)}>
          <Icon name="close" size={18} />
        </IconButton>
      </Box>

      {/* Multi-tab strip */}
      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'background.default', px: 1, pt: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={activeTab.id}
          onChange={(_, id) => setActiveId(id)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 32, flex: 1, '& .MuiTab-root': { minHeight: 32, py: 0.25, px: 1.25, fontSize: '0.74rem', textTransform: 'none' } }}
        >
          {tabs.map((t) => (
            <Tab
              key={t.id}
              value={t.id}
              label={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography noWrap sx={{ maxWidth: 140, fontSize: '0.74rem' }}>{t.title}</Typography>
                  <Box
                    component="span"
                    onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                    sx={{ display: 'inline-flex', p: 0.2, borderRadius: 0.5, '&:hover': { color: 'primary.main' } }}
                  >
                    <Icon name="close" size={13} />
                  </Box>
                </Stack>
              }
            />
          ))}
        </Tabs>
        <IconButton size="small" aria-label="New tab" onClick={addTab} sx={{ ml: 0.5 }}>
          <Icon name="plus" size={17} />
        </IconButton>
      </Box>

      {/* Address + navigation bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.75, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton size="small" aria-label="Back" disabled={activeTab.histIdx <= 0} onClick={() => stepHistory(-1)}>
          <Icon name="back" size={18} />
        </IconButton>
        <IconButton size="small" aria-label="Forward" disabled={activeTab.histIdx >= activeTab.history.length - 1} onClick={() => stepHistory(1)}>
          <Icon name="chevronRight" size={18} />
        </IconButton>
        <IconButton size="small" aria-label="Reload" onClick={() => { if (activeTab.url === 'joe://probe') { setProbe(null); setRunNonce((n) => n + 1); } }}>
          <Icon name="refresh" size={17} />
        </IconButton>
        <TextField
          size="small"
          fullWidth
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(addr); }}
          placeholder="Search or enter URL (or joe://probe)"
          inputProps={{ 'aria-label': 'Address bar', style: { paddingTop: 5, paddingBottom: 5, fontSize: '0.8rem' } }}
        />
        <IconButton size="small" aria-label="Bookmark page" onClick={toggleBookmark} color={isBookmarked ? 'primary' : 'default'}>
          <Icon name={isBookmarked ? 'star' : 'bookmark'} size={17} />
        </IconButton>
        <Button size="small" variant="contained" onClick={() => navigate(addr)} sx={{ minHeight: 30, px: 1.5 }}>Go</Button>
      </Box>

      {/* Quick detector & bookmark strip */}
      <Box sx={{ px: 1.25, py: 0.6, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.6, overflowX: 'auto' }}>
        {QUICK_SITES.map((q) => (
          <Chip
            key={q.url}
            label={q.label}
            size="small"
            clickable
            variant={activeTab.url === q.url ? 'filled' : 'outlined'}
            color={activeTab.url === q.url ? 'primary' : 'default'}
            onClick={() => navigate(q.url)}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
        ))}
      </Box>

      {/* Browser viewport */}
      <DialogContent sx={{ flex: 1, p: { xs: 1.5, md: 2.25 }, overflowY: 'auto', bgcolor: 'background.default' }}>
        {activeTab.url === 'joe://probe' ? (
          <Stack spacing={1.75}>
            <Paper variant="outlined" sx={{ p: 1.75 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
                <ScoreRing value={probe ? Math.round((probe.passed / Math.max(1, probe.total)) * 100) : consistency.score} size={64} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h4" sx={{ fontSize: '0.96rem' }}>
                    {probe ? `${probe.passed} of ${probe.total} runtime fingerprint checks passed` : 'Running live injection probe...'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {probe
                      ? (probe.failures.length ? `Review: ${probe.failures.join(', ')}` : 'Prototype descriptors, deterministic canvas, WebGL, timezone/locale, and engine globals agree.')
                      : 'Executing profile injection inside sandboxed document...'}
                  </Typography>
                </Box>
                <Tag tone={probe?.failures.length ? 'warn' : 'primary'}>
                  {probe ? (probe.failures.length ? 'Review' : 'Verified') : 'Checking'}
                </Tag>
              </Stack>
            </Paper>

            {probeData && (
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                  <Typography variant="overline" color="text.secondary">Live injected surfaces</Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                  {[
                    ['User-Agent', String(probeData.ua ?? '')],
                    ['Platform / Vendor', `${String(probeData.platform ?? '')} · ${String(probeData.vendor ?? '(empty)')}`],
                    ['Client Hints', (probeData.brands as string[])?.length ? `${(probeData.brands as string[]).join(', ')} (${String(probeData.chPlatform)})` : 'Absent (WebKit / Firefox)'],
                    ['Prototype mask', `Native getters: ${probeData.getterNative ? 'Yes' : 'No'} · No instance shadow: ${probeData.noInstanceShadow ? 'Yes' : 'No'}`],
                    ['Canvas stability', probeData.canvasStable ? `Deterministic & idempotent (seed ${String(probeData.seed)})` : 'Mismatch'],
                    ['WebGL', `${String((probeData.gl as { vendor?: string })?.vendor ?? '')} · ${String((probeData.gl as { renderer?: string })?.renderer ?? '')}`],
                    ['Timezone & Offset', `${String(probeData.zone ?? '')} (UTC offset ${String(probeData.offset ?? '')}m)`],
                    ['Screen & Hardware', `${String(probeData.screen ?? '')} @${String(probeData.dpr ?? '')} · ${String(probeData.cores ?? '')} cores · ${String(probeData.touch ?? '')} touch`],
                  ].map(([k, v], idx, arr) => (
                    <Box
                      key={k}
                      sx={{
                        p: 1.25,
                        borderBottom: idx < arr.length - 1 ? '1px solid' : 'none',
                        ...(idx >= arr.length - 2 ? { borderBottom: { xs: idx < arr.length - 1 ? '1px solid' : 'none', md: 'none' } } : {}),
                        borderRight: { md: idx % 2 === 0 ? '1px solid' : 'none' },
                        borderColor: 'divider',
                        minWidth: 0,
                      }}
                    >
                      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{k}</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 500, wordBreak: 'break-word', display: 'block', mt: 0.25 }}>{v}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {probeDoc && (
              <iframe
                key={token}
                title="Isolated profile probe frame"
                sandbox="allow-scripts"
                srcDoc={probeDoc}
                style={{ width: 1, height: 1, border: 0, position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
            )}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h4" sx={{ fontSize: '0.96rem' }}>{activeTab.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{activeTab.url}</Typography>
                </Box>
                <Button
                  component="a"
                  href={activeTab.url}
                  target="_blank"
                  rel="noreferrer"
                  variant="contained"
                  size="small"
                  endIcon={<Icon name="open" size={16} />}
                >
                  Open in external tab
                </Button>
              </Stack>
              <Divider />
              <Typography variant="caption" color="text.secondary">
                Third-party detector and web sites restrict embedded iframes in web mode. Full network proxy routing and live CDP header/JS injection run inside the isolated Desktop or Android profile window with these exact parameters:
              </Typography>
              <Box sx={{ p: 1.25, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                <div>User-Agent: {spec.userAgent}</div>
                <div>Accept-Language: {accepts}</div>
                <div>Sec-CH-UA: {supportsCh ? (spec.uaClientHints.secChUa || 'enabled') : '(omitted for WebKit/Firefox)'}</div>
                <div>WebRTC: {spec.webrtcMode} · Timezone: {spec.timezone}</div>
              </Box>
            </Stack>
          </Paper>
        )}
      </DialogContent>
    </Dialog>
  );
}
