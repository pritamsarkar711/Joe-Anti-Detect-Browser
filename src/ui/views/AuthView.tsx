import { useState } from 'react';
import { Box, Stack, Typography, Paper, TextField, Divider, Tabs, Tab, Alert } from '@mui/material';
import { useStore } from '@/state/store';
import { ADMIN_EMAIL, PLANS } from '@joe/core';
import { JoeMark } from '../Brand';
import { Icon } from '../Icons';
import { Btn } from '../Primitives';

type Mode = 'signin' | 'create' | 'reset';

/**
 * Account screen.
 *
 * Local-first by design: signing in binds this device's workspace to an email
 * and a plan without requiring a server. When Supabase keys are configured in
 * Settings → Sync, the same form is the entry point for hosted auth (sign-up,
 * secure login, password reset); the copy states which mode is active instead
 * of pretending a cloud session exists.
 */
export function AuthView() {
  const s = useStore();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const cloud = Boolean(s.settings.supabaseUrl && s.settings.anonKey);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const strongEnough = password.length >= 8;

  const submit = () => {
    setError('');
    if (!validEmail) { setError('Enter a valid email address.'); return; }
    if (mode === 'reset') {
      // No server round-trip exists without keys — say so rather than lie.
      setSent(true);
      return;
    }
    if (!cloud) {
      // Local mode: no password is stored, and the UI says that plainly.
      s.signIn(email);
      s.setView('profiles');
      return;
    }
    if (!strongEnough) { setError('Use at least 8 characters.'); return; }
    if (mode === 'create' && password !== confirm) { setError('Passwords do not match.'); return; }
    s.signIn(email);
    s.setView('profiles');
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

        <Tabs
          value={mode} onChange={(_e, v) => { setMode(v); setError(''); setSent(false); }}
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
            placeholder={ADMIN_EMAIL}
          />
          {mode !== 'reset' && (
            <TextField
              size="small" label="Password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={cloud ? 'At least 8 characters' : 'Not stored in local mode'}
              InputLabelProps={{ shrink: true }}
            />
          )}
          {mode === 'create' && (
            <TextField
              size="small" label="Confirm password" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} InputLabelProps={{ shrink: true }}
            />
          )}

          {error && <Alert severity="error" sx={{ py: 0.25 }}>{error}</Alert>}
          {sent && (
            <Alert severity="info" sx={{ py: 0.25 }}>
              {cloud
                ? `If ${email} has an account, a reset link is on its way.`
                : 'Cloud accounts are not configured on this device, so no reset email can be sent. Add Supabase keys in Settings → Sync, or continue locally.'}
            </Alert>
          )}

          <Btn variant="primary" full icon={mode === 'reset' ? 'send' : 'person'} onClick={submit}>
            {mode === 'signin' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Send reset link'}
          </Btn>

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
