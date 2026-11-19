import type { ReactNode, ChangeEvent } from 'react';
import {
  Button, IconButton, Tooltip, Paper, Chip, TextField, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Box, Typography, Stack, Snackbar, Alert, LinearProgress,
} from '@mui/material';
import { Icon, type IconName } from './Icons';
import { useStore } from '@/state/store';

export function Btn({
  children, icon, variant = 'ghost', size = 'medium', onClick, disabled, type = 'button', full, title,
}: {
  children?: ReactNode; icon?: IconName; variant?: 'primary' | 'ghost' | 'subtle' | 'danger';
  size?: 'small' | 'medium' | 'large'; onClick?: () => void; disabled?: boolean;
  type?: 'button' | 'submit'; full?: boolean; title?: string;
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  return (
    <Button
      type={type} onClick={onClick} disabled={disabled} fullWidth={full} size={size} title={title}
      variant={isPrimary ? 'contained' : 'outlined'}
      color={isDanger ? 'error' : 'primary'}
      startIcon={icon ? <Icon name={icon} size={size === 'small' ? 18 : 20} /> : undefined}
      sx={{
        ...(variant === 'subtle' ? { borderColor: 'transparent', color: 'text.secondary' } : {}),
        ...(variant === 'ghost' ? { borderColor: 'divider', color: 'text.primary' } : {}),
      }}
    >
      {children}
    </Button>
  );
}

export function IconBtn({
  icon, label, onClick, size = 20, disabled, color,
}: { icon: IconName; label: string; onClick?: () => void; size?: number; disabled?: boolean; color?: string }) {
  return (
    <Tooltip title={label} placement="top" arrow>
      <span>
        <IconButton onClick={onClick} disabled={disabled} aria-label={label} size="small" sx={{ p: 0.85 }}>
          <Icon name={icon} size={size} color={color} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

export function Panel({ children, title, action, sx, pad = 2 }: {
  children: ReactNode; title?: ReactNode; action?: ReactNode; sx?: object; pad?: number;
}) {
  return (
    <Paper variant="outlined" sx={{ p: pad, ...sx }}>
      {title && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: pad }}>
          <Typography variant="h6" sx={{ fontSize: '0.86rem' }}>{title}</Typography>
          {action}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

export function Tag({ children, tone = 'neutral', onClick }: {
  children: ReactNode; tone?: 'primary' | 'neutral' | 'ok' | 'warn' | 'err'; onClick?: () => void;
}) {
  const color = tone === 'primary' ? 'primary' : tone === 'err' ? 'error' : 'default';
  return (
    <Chip
      label={children} size="small" onClick={onClick} color={color}
      variant={tone === 'primary' ? 'filled' : 'outlined'}
      sx={{ height: 22, fontSize: '0.68rem', borderColor: 'divider', ...(tone === 'primary' ? { color: '#fff' } : {}) }}
    />
  );
}

export function Field({
  label, value, onChange, placeholder, multiline, rows, type = 'text', disabled, helper,
}: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; rows?: number; type?: string; disabled?: boolean; helper?: string;
}) {
  return (
    <TextField
      fullWidth size="small" label={label} value={value} placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      multiline={multiline} rows={rows} type={type} disabled={disabled} helperText={helper}
      InputLabelProps={{ shrink: true }}
    />
  );
}

export function SelectField<T extends string>({
  label, value, onChange, options, disabled,
}: {
  label?: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; disabled?: boolean;
}) {
  return (
    <TextField
      fullWidth select size="small" label={label} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)} InputLabelProps={{ shrink: true }}
    >
      {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </TextField>
  );
}

export function Modal({
  open, onClose, title, subtitle, children, actions, width = 520,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: ReactNode; actions?: ReactNode; width?: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { maxWidth: width, width: '100%' } }} fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        {title}
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{subtitle}</Typography>}
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

export function Empty({ icon = 'layers', title, hint, action }: {
  icon?: IconName; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 7, textAlign: 'center' }}>
      <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'primary.main' }}>
        <Icon name={icon} size={26} />
      </Box>
      <Typography variant="h6">{title}</Typography>
      {hint && <Typography variant="body2" color="text.secondary">{hint}</Typography>}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}

export function StatCard({ icon, label, value, note }: { icon: IconName; label: string; value: ReactNode; note?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.6, minWidth: 0 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', flex: 'none' }}>
        <Icon name={icon} size={22} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{label}</Typography>
        <Typography variant="h3" sx={{ fontSize: '1.35rem', lineHeight: 1.2 }}>{value}</Typography>
        {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
      </Box>
    </Paper>
  );
}

/** Circular score indicator. Flat colour, no gradient. */
export function ScoreRing({ value, size = 68, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D81B60" strokeWidth={5}
          strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontSize: size > 60 ? '1.05rem' : '0.85rem', lineHeight: 1 }}>{label ?? Math.round(value)}</Typography>
      </Box>
    </Box>
  );
}

export function SectionHead({ kicker, title, hint, action }: { kicker?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
      <Box>
        {kicker && <Typography variant="overline" color="primary.main" sx={{ display: 'block' }}>{kicker}</Typography>}
        <Typography variant="h2">{title}</Typography>
        {hint && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{hint}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

export function BusyBar({ show = true }: { show?: boolean }) {
  return show ? <LinearProgress sx={{ height: 2, mb: 2 }} /> : null;
}

export function Toasts() {
  const s = useStore();
  const t = s.toasts[0];
  return (
    <Snackbar
      open={!!t} autoHideDuration={3200} onClose={() => t && s.dismissToast(t.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ bottom: { xs: 76, md: 24 } }}
    >
      <Alert
        severity={t?.kind === 'err' ? 'error' : t?.kind === 'warn' ? 'warning' : t?.kind === 'info' ? 'info' : 'success'}
        variant="filled" onClose={() => t && s.dismissToast(t.id)} sx={{ alignItems: 'center' }}
      >
        {t?.text}
      </Alert>
    </Snackbar>
  );
}
