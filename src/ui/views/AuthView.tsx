import { useEffect, useState } from 'react';
import { Box, Stack, Typography, Paper, TextField, Divider, Tabs, Tab, Alert, CircularProgress } from '@mui/material';
import { useStore } from '@/state/store';
import { PLANS } from '@joe/core';
import { JoeMark } from '../Brand';
import { Icon } from '../Icons';
import { Btn, Tag } from '../Primitives';

type Mode = 'signin' | 'create' | 'reset';

/**
 * Account screen.
 *
 * Two clearly separated states:
 *
 * - **Cloud** (a Supabase URL and publishable key are set): sign-up, password
 *   login and password recovery are real requests, and the plan shown here is
 *   read back from `my_entitlement()`. A password is never stored in the app.
 * - **Local** (no project configured): the workspace belongs to this device.
 *   No email is treated as an identity and no paid tier is granted — the screen
 *   says that instead of showing a form that only pretends to authenticate.
 */
export function AuthView() {
  const s = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const cloud = s.cloudConfigured;
  const signedIn = s.authStatus === 'cloud' || s.authStatus === 'cloud-offline';

  useEffect(() => { setError(''); setInfo(''); }, [mode]);

  const submit = async () => {
    setError('');
    setInfo('');
    if (mode === 'reset') {
      const outcome = await s.resetPassword(email);
      if (outcome.error) setError(outcome.error);
      else setInfo(outcome.info ?? 'Reset email sent.');
      return;
    }
    if (mode === 'create' && password !== confirm) { setError('Passwords do not match.'); return; }
    const outcome = mode === 'create' ? await s.signUp(email, password) : await s.signIn(email, password);
    if (outcome.error) { setError(outcome.error); return; }
    if (outcome.info) setInfo(outcome.info);
  };

  if (signedIn) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '70dvh', px: 2 }}>
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 460, p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <JoeMark size={36} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{s.cloudEmail ?? s.account.email}</Typography>
                <Typography variant="caption" color="text.secondary">{s.planLabel}</Typography>
              </Box>
              {s.account.role === 'owner' && <Tag tone="primary">Owner</Tag>}
            </Stack>
            <Alert
              severity={s.authStatus === 'cloud' ? 'success' : 'warning'}
              variant="outlined"
              icon={<Icon name={s.authStatus === 'cloud' ? 'shield' : 'alert'} size={20} />}
            >
              {s.planNotice}
            </Alert>
            <Divider />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Btn icon="refresh" onClick={() => { void s.refreshEntitlement(); }}>Refresh plan</Btn>
              <Btn icon="restart" onClick={() => s.signOut()}>Sign out</Btn>
              <Btn variant="primary" icon="arrow" onClick={() => s.setView('profiles')}>Profiles</Btn>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '70dvh', px: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 400, p: { xs: 2, sm: 3 } }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <JoeMark size={40} />
          <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>Joe Browser</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            {PLANS.free.profileLimit} free profiles · Premium unlimited
          </Typography>
        </Stack>

        <Tabs
          value={mode} onChange={(_e, v) => setMode(v)}
          variant="fullWidth" sx={{ mb: 2, minHeight: 34, '& .MuiTab-root': { minHeight: 34, fontSize: '0.76rem' } }}
        >
          <Tab value="signin" label="Sign in" />
          <Tab value="create" label="Create" />
          <Tab value="reset" label="Reset" />
        </Tabs>

        <Stack spacing={1.5}>
          <TextField
            size="small" label="Email" type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)} InputLabelProps={{ shrink: true }}
            disabled={s.authBusy}
          />
          {mode !== 'reset' && (
            <TextField
              size="small" label="Password" type="password" value={password}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              helperText="At least 8 characters"
              disabled={s.authBusy}
            />
          )}
          {mode === 'create' && (
            <TextField
              size="small" label="Confirm password" type="password" value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              disabled={s.authBusy}
            />
          )}

          {error && <Alert severity="error" sx={{ py: 0.25, fontSize: '0.78rem' }}>{error}</Alert>}
          {info && <Alert severity="info" sx={{ py: 0.25, fontSize: '0.78rem' }}>{info}</Alert>}

          <Btn
            variant="primary" full
            icon={mode === 'reset' ? 'send' : 'person'}
            onClick={() => { void submit(); }}
            disabled={s.authBusy || !cloud}
          >
            {s.authBusy
              ? <CircularProgress size={16} color="inherit" />
              : mode === 'signin' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Send reset link'}
          </Btn>

          <Divider />

          <Btn full icon="arrow" onClick={() => s.continueLocally()}>
            Continue offline
          </Btn>
        </Stack>
      </Paper>
    </Box>
  );
}
