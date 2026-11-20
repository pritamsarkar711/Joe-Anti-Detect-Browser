import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Select, MenuItem, Divider, Chip, LinearProgress,
  List, ListItemButton, ListItemIcon, ListItemText, Alert,
} from '@mui/material';
import { useStore } from '@/state/store';
import { checkProfile, downloadFile, type BrowserProfile } from '@joe/core';
import { buildInjectionScript } from '@joe/fingerprint';
import { Icon } from '../Icons';
import { Official } from '../Brand';
import { Btn, MetricStrip, PageHead, Panel, ScoreRing, Tag } from '../Primitives';

interface ProbeResult { passed: number; total: number; failures: string[]; probe: Record<string, unknown> }

const DETECTORS = [
  { name: 'IP Fighter', url: 'https://ipfighter.com/', focus: 'Proxy IP, DNS, WebRTC and timezone agreement', icon: 'globe' as const },
  { name: 'Pixelscan', url: 'https://pixelscan.net/', focus: 'UA, Client Hints, canvas, WebGL and bot signals', icon: 'science' as const },
  { name: 'IPHey', url: 'https://iphey.com/', focus: 'IP reputation and browser consistency', icon: 'verified' as const },
  { name: 'AmIUnique', url: 'https://amiunique.org/', focus: 'Fingerprint rarity across a large reference set', icon: 'fingerprints' as const },
  { name: 'CreepJS', url: 'https://abrahamjuliot.github.io/creepjs/', focus: 'Prototype, worker and headless side channels', icon: 'bug' as const },
  { name: 'BrowserLeaks', url: 'https://browserleaks.com/', focus: 'Canvas, WebGL, fonts, WebRTC and geolocation', icon: 'web' as const },
];

function selfTestHtml(p: BrowserProfile): string {
  const script = buildInjectionScript(p.fingerprint, { selfTestHook: true }).replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Joe Browser self test</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#fff;color:#15131a}main{max-width:720px;margin:8vh auto;padding:24px}.card{border:1px solid #e8e4e8;padding:18px;margin:12px 0}.ok{color:#d81b60;font-weight:700}pre{white-space:pre-wrap;word-break:break-word;background:#f7f5f7;padding:12px;font-size:13px}</style>
</head><body><main><h1>Joe Browser self test</h1><p>This page runs the exact JavaScript injection payload used by the desktop and Android shells.</p><div id="out">Running…</div><script>${script}</script><script>
var r=window.__joeVerify();var o=document.getElementById('out');
o.innerHTML='<div class="card"><div class="ok">'+r.passed+' / '+r.total+' internal checks passed</div><p>'+(r.failures.length?'Review: '+r.failures.join(', '):'No internal contradictions found.')+'</p></div><pre>'+JSON.stringify(r.probe,null,2)+'</pre>';
</script></main></body></html>`;
}

export function TestsView() {
  const s = useStore();
  const [profileId, setProfileId] = useState(s.profiles[0]?.id ?? '');
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const p = s.profiles.find((x) => x.id === profileId) ?? s.profiles[0];
  const report = p ? checkProfile(p) : null;

  useEffect(() => {
    if (!result && !s.profiles.length) return;
    if (profileId || !s.profiles.length) return;
    setProfileId(s.profiles[0].id);
  }, [s.profiles, profileId, result]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; result?: ProbeResult };
      if (d?.source !== 'joe-self-test' || !d.result) return;
      setResult(d.result); setRunning(false);
      s.toast(d.result.failures.length ? `${d.result.failures.length} checks need review` : 'Local probe passed', d.result.failures.length ? 'warn' : 'ok');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [s]);

  const probeDoc = useMemo(() => {
    if (!p || !running) return '';
    const injection = buildInjectionScript(p.fingerprint, { selfTestHook: true }).replace(/<\/script/gi, '<\\/script');
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${injection}</script><script>try{var r=window.__joeVerify();parent.postMessage({source:'joe-self-test',result:r},'*')}catch(e){parent.postMessage({source:'joe-self-test',result:{passed:0,total:1,failures:[String(e)],probe:{}}},'*')}</script></body></html>`;
  }, [p, running]);

  const run = () => {
    if (!p) return;
    setResult(null); setRunning(true); setRunKey((k) => k + 1);
    setTimeout(() => setRunning(false), 6000);
  };
  const download = () => p && downloadFile('joe-self-test.html', selfTestHtml(p), 'text/html');

  return (
    <Box>
      <PageHead
        title="Leak check" hint="Internal self test plus independent detector links."
        action={
          <>
            <Btn icon="download" onClick={download}>Save test page</Btn>
            <Btn variant="primary" icon="factcheck" onClick={run} disabled={!p || running}>{running ? 'Running…' : 'Run local probe'}</Btn>
          </>
        }
      />

      <MetricStrip
        items={[
          { label: 'Local checks', value: result ? `${result.passed}/${result.total}` : 'Not run' },
          { label: 'Consistency', value: report ? `${report.score}%` : '—' },
          { label: 'Detectors', value: DETECTORS.length },
        ]}
      />

      <Box sx={{ mt: 1.75 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
          <Panel title="Live JavaScript probe">
            <Stack spacing={1.6}>
              <Select size="small" fullWidth value={p?.id ?? ''} onChange={(e) => { setProfileId(e.target.value); setResult(null); }} displayEmpty>
                {s.profiles.map((x) => <MenuItem key={x.id} value={x.id}>{x.name} · {x.fingerprint.uaClientHints.platform}</MenuItem>)}
              </Select>
              <Typography variant="body2" color="text.secondary">Runs the exact injection payload in a sandboxed frame and verifies every JS surface against one observed device.</Typography>
              {running && <LinearProgress />}
              {result && (
                <Paper variant="outlined" sx={{ p: 1.6 }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <ScoreRing value={Math.round((result.passed / Math.max(1, result.total)) * 100)} size={64} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="h4">{result.passed} of {result.total} checks passed</Typography>
                      <Typography variant="caption" color="text.secondary">{result.failures.length ? `Review ${result.failures.join(', ')}` : 'No internal contradictions found.'}</Typography>
                    </Box>
                    <Tag tone={result.failures.length ? 'warn' : 'primary'}>{result.failures.length ? 'Review' : 'Passed'}</Tag>
                  </Stack>
                  <Divider sx={{ my: 1.4 }} />
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.7 }}>Probe</Typography>
                  <Box component="pre" sx={{ m: 0, p: 1, bgcolor: 'action.hover', fontSize: '0.68rem', maxHeight: 190, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(result.probe, null, 2)}
                  </Box>
                </Paper>
              )}
              <Alert severity="info" variant="outlined" icon={<Icon name="info" size={22} />}>
                Verifies internal JS, Canvas, Audio, WebGL, timezone, and WebRTC consistency.
              </Alert>
              {running && probeDoc && (
                <iframe key={runKey} ref={frameRef} title="Joe Browser local probe" sandbox="allow-scripts" srcDoc={probeDoc} style={{ width: 1, height: 1, border: 0, position: 'absolute', opacity: 0 }} />
              )}
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Panel title="Independent detectors" pad={0}>
            <List disablePadding>
              {DETECTORS.map((d) => (
                <ListItemButton key={d.name} component="a" href={d.url} target="_blank" rel="noreferrer" sx={{ px: 2, py: 1.35, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemIcon sx={{ minWidth: 40 }}><Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main' }}><Icon name={d.icon} size={19} /></Box></ListItemIcon>
                  <ListItemText primary={d.name} secondary={d.focus} primaryTypographyProps={{ fontSize: '0.84rem', fontWeight: 600 }} secondaryTypographyProps={{ variant: 'caption' }} />
                  <Icon name="open" size={19} />
                </ListItemButton>
              ))}
            </List>
            <Box sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}><Official name="github" size={18} /><Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Validation checklist</Typography></Stack>
              <Typography variant="caption" color="text.secondary">Open each detector in a launched session and compare exit IP geo against timezone, locale, WebRTC, and Client Hints.</Typography>
            </Box>
          </Panel>
        </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
