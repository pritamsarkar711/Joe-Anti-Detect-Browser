import { useMemo, useState } from 'react';
import { Box, Stack, Typography, TextField, ToggleButton, ToggleButtonGroup, Divider } from '@mui/material';
import { describeSchedule, humanPasteSchedule, scheduleDuration } from '@joe/fingerprint';
import { useStore } from '@/state/store';
import { Icon } from '../Icons';
import { Btn, Tag } from '../Primitives';

interface Props {
  profileName: string;
  profileId: string;
  /** optional: text the user last pasted, prefilled for convenience */
  initial?: string;
}

/**
 * Manual entry helper, not an automation feature.
 *
 * The user pastes text here and reviews the resulting keystroke plan before
 * committing it. On the desktop shell the plan is replayed into the open
 * profile window through CDP `Input.dispatchKeyEvent` with each per-key delay
 * honoured; elsewhere the plan is copied so the user can paste it by hand —
 * the button always says which of the two it will do. Nothing runs in the
 * background and no challenge is solved: if a site asks for a CAPTCHA, a
 * person solves it.
 */
export function PasteAsHuman({ profileName, profileId, initial = '' }: Props) {
  const s = useStore();
  const [text, setText] = useState(initial);
  const [speed, setSpeed] = useState<'relaxed' | 'natural' | 'brisk'>('natural');
  const [withTypos, setWithTypos] = useState(true);
  const [sending, setSending] = useState(false);

  /** Only the desktop shell can replay keys; everywhere else we say copy. */
  const canSend = typeof window !== 'undefined' && !!window.joe?.keystrokes?.send;

  const send = async () => {
    if (!text) return;
    if (!canSend) {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
      s.toast('Plan copied — open the profile window and paste it there.', 'info');
      return;
    }
    setSending(true);
    try {
      const result = await window.joe!.keystrokes!.send(profileId, schedule);
      if (result && result.ok === false) {
        s.toast(result.reason || 'The profile window refused the plan.', 'warn');
      } else {
        s.toast(`Typing into ${profileName} — keep that window focused.`, 'ok');
      }
    } catch {
      s.toast('The profile window could not take the plan.', 'warn');
    } finally {
      setSending(false);
    }
  };

  const options = useMemo(() => ({
    baseDelay: speed === 'relaxed' ? 90 : speed === 'brisk' ? 22 : 42,
    jitter: speed === 'relaxed' ? 60 : speed === 'brisk' ? 18 : 34,
    typoChance: withTypos ? 0.015 : 0,
  }), [speed, withTypos]);

  const schedule = useMemo(() => (text ? humanPasteSchedule(text, options) : []), [text, options]);
  const seconds = scheduleDuration(schedule) / 1000;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main' }}><Icon name="paste" size={17} /></Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>Paste as human</Typography>
          <Typography variant="caption" color="text.secondary">Replays text as real key events for {profileName}</Typography>
        </Box>
      </Stack>

      <TextField
        size="small" multiline minRows={4} maxRows={8} value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type the text you want entered into the page…"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">Typing pace</Typography>
          <ToggleButtonGroup
            exclusive size="small" value={speed} fullWidth
            onChange={(_e, v) => v && setSpeed(v)}
            sx={{ mt: 0.5, '& .MuiToggleButton-root': { py: 0.35, fontSize: '0.72rem', textTransform: 'none' } }}
          >
            <ToggleButton value="relaxed">Relaxed</ToggleButton>
            <ToggleButton value="natural">Natural</ToggleButton>
            <ToggleButton value="brisk">Brisk</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 150 } }}>
          <Typography variant="caption" color="text.secondary">Corrections</Typography>
          <ToggleButtonGroup
            exclusive size="small" value={withTypos ? 'on' : 'off'} fullWidth
            onChange={(_e, v) => v && setWithTypos(v === 'on')}
            sx={{ mt: 0.5, '& .MuiToggleButton-root': { py: 0.35, fontSize: '0.72rem', textTransform: 'none' } }}
          >
            <ToggleButton value="on">Occasional</ToggleButton>
            <ToggleButton value="off">None</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>

      <Divider />

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <Tag tone="neutral">{schedule.length} keys</Tag>
          <Tag tone={seconds > 45 ? 'warn' : 'primary'}>{seconds ? `${seconds.toFixed(1)}s` : 'no text'}</Tag>
        </Stack>
        <Stack direction="row" spacing={0.75}>
          <Btn size="small" icon="copy" onClick={() => navigator.clipboard?.writeText(text).catch(() => undefined)} disabled={!text}>Copy</Btn>
          <Btn
            size="small" variant="primary" icon="send" disabled={!text || sending}
            onClick={() => { void send(); }}
          >
            {canSend ? (sending ? 'Typing…' : `Send to ${profileName}`) : 'Copy plan'}
          </Btn>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {schedule.length ? describeSchedule(schedule) : 'Nothing queued yet.'} Keys are paced with per-character jitter and
        word-boundary beats. This helps with ordinary typing-detection heuristics; it does not solve CAPTCHAs, and a person must
        complete any challenge a site presents.
      </Typography>
    </Stack>
  );
}
