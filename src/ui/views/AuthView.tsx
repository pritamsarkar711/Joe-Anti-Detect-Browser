import { useEffect, useState } from 'react';
import { Box, Stack, Typography, Paper, TextField, Divider, Tabs, Tab, Alert, Chip } from '@mui/material';
import { useStore } from '@/state/store';
import { PLANS } from '@joe/core';
import {
  authClient, completePasswordReset, currentSession, fetchServerAccount,
  onAuthStateChange, sendPasswordReset, signIn as cloudSignIn, signOut as cloudSignOut,
  signUp as cloudSignUp,
} from '@/state/auth';
import { accountFromServer } from '@joe/core';
import { JoeMark } from '../Brand';
import { Btn } from '../Primitives';

type Mode = 'signin' | 'create' | 'reset' | 'recovery';

/**
 * Account screen.
 *
 * Local mode (no keys): signing in binds this device's workspace to an email
 * and a plan without a server, and the copy says so.
 *
 * Cloud mode (keys in Settings → Sync): the same form runs real Supabase
 * auth — sign-up with email confirmation, password sign-in, password reset by
 * email, paste-the-link recovery, session persistence, and entitlement read
 * from the guarded `accounts` row.
 */
export function AuthView() {
  const s = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryLink, setRecoveryLink] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const cloud = Boolean(s.settings.supabaseUrl && s.settings.anonKey);
  const client = authClient(s.settings.supabaseUrl, s.settings.anonKey);

  // Track the live cloud session so the screen can show who is signed in.
  useEffect(() => {
    if (!client) { setSessionEmail(null); return; }
    let cancelled = false;
    void currentSession(client).then((session) => {
      if (!cancelled) setSessionEmail(session?.user?.email ?? null);
    });
    const off = onAuthStateChange(client, (_event, session) => {
      if (!cancelled) setSessionEmail(session?.user?.email ?? null);
    });
    return () => { cancelled = true; off(); };
  }, [client]);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const strongEnough = password.length >= 8;

  const finishSignIn = async (sessionEmailArg: string) => {
    const row = client ? await fetchServerAccount(client) : null;
    s.signIn(sessionEmailArg, row ? accountFromServer(row, sessionEmailArg) : null);
    s.setView('profiles');
  };

  const submit = async () => {
    setError('');
    setInfo('');
    if (!validEmail) { setError('Enter a valid email address.'); return; }

    if (mode === 'recovery') {
      setBusy(true);
      const result = client
        ? await completePasswordReset(client, recoveryLink, password)
        : { ok: false, error: 'Cloud accounts are not configured on this device.' };
      setBusy(false);
      if (!result.ok) { setError(result.error ?? 'Reset failed.'); return; }
      setInfo('Password updated. You are signed in.');
      setMode('signin');
      setPassword('');
      setRecoveryLink('');
      if (client) {
        const session = await currentSession(client);
        if (session?.user?.email) await finishSignIn(session.user.email);
      }
      return;
    }

    if (mode === 'reset') {
      if (!cloud || !client) {
        // No server round-trip exists without keys — say so rather than lie.
        setInfo('Cloud accounts are not configured on this device, so no reset email can be sent. Add Supabase keys in Settings → Sync, or continue locally.');
        return;
      }
      setBusy(true);
      const result = await sendPasswordReset(client, email.trim().toLowerCase());
      setBusy(false);
      if (!result.ok) { setError(result.error ?? 'Could not send the reset email.'); return; }
      setInfo('If that address has an account, a reset link is on its way. Open it, then paste the link here to set a new password.');
      setMode('recovery');
      return;
    }

    if (!cloud || !client) {
      // Local mode: no password is stored, and the UI says that plainly.
      s.signIn(email);
      s.setView('profiles');
      return;
    }

    if (!strongEnough) { setError('Use at least 8 characters.'); return; }
    if (mode === 'create' && password !== confirm) { setError('Passwords do not match.'); return; }

    setBusy(true);
    const result = mode === 'create'
      ? await cloudSignUp(client, email.trim().toLowerCase(), password)
      : await cloudSignIn(client, email.trim().toLowerCase(), password);
    setBusy(false);

    if (!result.ok) { setError(result.error ?? 'Authentication failed.'); return; }
    if (result.needsConfirmation) {
      setInfo('Check your inbox — confirm your email address, then sign in.');
      setMode('signin');
      setPassword('');
      return;
    }
    if (result.session?.user?.email) {
      await finishSignIn(result.session.user.email);
      return;
    }
    setInfo('Signed in.');
    s.setView('profiles');
  };

  const signOut = async () => {
    if (client) await cloudSignOut(client);
    s.signOut();
    setSessionEmail(null);
    setInfo('Signed out.');
  };

  const switchMode = (_e: unknown, v: Mode) => {
    setMode(v); setError(''); setInfo(''); setPassword(''); setConfirm(''); setRecoveryLink('');
  };

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '70dvh', px: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 400, p: { xs: 2, sm: 3 } }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <JoeMark size={40} />
          <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>Joe Browser</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            {PLANS.free.profileLimit} free profiles for life. Premium unlocks every engine and unlimited profiles.
          </Typography>
        </Stack>

        {sessionEmail && (
          <Alert
            severity="info" sx={{ mb: 1.5, py: 0.25 }}
            action={<Btn size="small" onClick={() => void signOut()}>Sign out</Btn>}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{sessionEmail}</Typography>
              <Chip size="small" label={s.planLabel} sx={{ height: 18, fontSize: '0.66rem' }} />
            </Stack>
          </Alert>
        )}

        <Tabs
          value={mode === 'recovery' ? 'reset' : mode} onChange={switchMode}
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
            placeholder="you@example.com"
          />
          {mode !== 'reset' && (
            <TextField
              size="small"
              label={mode === 'recovery' ? 'New password' : 'Password'}
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={cloud ? 'At least 8 characters' : 'Not stored in local mode'}
              InputLabelProps={{ shrink: true }}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            />
          )}
          {mode === 'create' && (
            <TextField
              size="small" label="Confirm password" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              InputLabelProps={{ shrink: true }} autoComplete="new-password"
            />
          )}
          {mode === 'recovery' && (
            <TextField
              size="small" label="Reset link from your email" value={recoveryLink}
              onChange={(e) => setRecoveryLink(e.target.value)}
              placeholder="https://…/#access_token=…"
              InputLabelProps={{ shrink: true }} multiline minRows={2}
            />
          )}

          {error && <Alert severity="error" sx={{ py: 0.25 }}>{error}</Alert>}
          {info && <Alert severity="info" sx={{ py: 0.25 }}>{info}</Alert>}

          <Btn variant="primary" full disabled={busy} icon={mode === 'reset' ? 'send' : 'person'} onClick={() => void submit()}>
            {mode === 'signin' ? 'Sign in'
              : mode === 'create' ? 'Create account'
              : mode === 'reset' ? 'Send reset link'
              : 'Set new password'}
          </Btn>

          {mode === 'recovery' && (
            <Btn full icon="arrow" onClick={() => { setMode('reset'); setError(''); setInfo(''); }}>
              Send a new link
            </Btn>
          )}

          <Divider />
          <Btn full icon="arrow" onClick={() => { s.setView('profiles'); }}>
            Continue without an account
          </Btn>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            {cloud
              ? 'Accounts are handled by your Supabase project. Passwords are never stored by the app.'
              : 'Local mode: your email and plan stay on this device. No password is stored or sent.'}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
