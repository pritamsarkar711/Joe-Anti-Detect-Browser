import type { ReactNode } from 'react';
import type { SxProps } from '@mui/material';
import {
  Button, IconButton, Tooltip, Paper, Chip, TextField, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Box, Typography, Stack, Snackbar, Alert, LinearProgress,
} from '@mui/material';
import { Icon, type IconName } from './Icons';
import { useStore } from '@/state/store';

export function Btn({
  children, icon, variant = 'ghost', size = 'medium', onClick, href, target, rel, disabled, type = 'button', full, title, 'aria-label': ariaLabel,
}: {
  children?: ReactNode; icon?: IconName; variant?: 'primary' | 'ghost' | 'subtle' | 'danger';
  size?: 'small' | 'medium' | 'large'; onClick?: () => void; href?: string; target?: string; rel?: string;
  disabled?: boolean; type?: 'button' | 'submit'; full?: boolean; title?: string; 'aria-label'?: string;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Button
      {...(href ? { component: 'a', href, target, rel } : { type })}
      onClick={onClick} disabled={disabled} fullWidth={full} size={size} title={title} aria-label={ariaLabel}
      variant={isPrimary ? 'contained' : 'text'}
      color={variant === 'danger' ? 'error' : 'primary'}
      startIcon={icon ? <Icon name={icon} size={size === 'small' ? 17 : 19} /> : undefined}
      sx={{
        minWidth: 0, px: size === 'small' ? 1 : 1.5,
        ...(isPrimary
          ? {}
          : { color: variant === 'danger' ? 'error.main' : variant === 'subtle' ? 'text.secondary' : 'text.primary' }),
      }}
    >
      {children}
    </Button>
  );
}

export function IconBtn({
  icon, label, onClick, href, target, rel, size = 19, disabled, color, sx,
}: {
  icon: IconName; label: string; onClick?: () => void; href?: string; target?: string; rel?: string;
  size?: number; disabled?: boolean; color?: string; sx?: SxProps;
}) {
  return (
    <Tooltip title={label} placement="top" arrow enterDelay={420}>
      <Box component="span" sx={[{ display: 'inline-flex' }, ...(Array.isArray(sx) ? sx : [sx])]}>
        {href ? (
          <IconButton component="a" href={href} target={target} rel={rel} disabled={disabled} aria-label={label} size="small" sx={{ p: 0.7 }}>
            <Icon name={icon} size={size} color={color} />
          </IconButton>
        ) : (
          <IconButton onClick={onClick} disabled={disabled} aria-label={label} size="small" sx={{ p: 0.7 }}>
            <Icon name={icon} size={size} color={color} />
          </IconButton>
        )}
      </Box>
    </Tooltip>
  );
}

/** Flat surface. One border, one radius, no shadow — keeps long pages calm. */
export function Panel({ children, title, action, sx, pad = 2 }: {
  children: ReactNode; title?: ReactNode; action?: ReactNode; sx?: object; pad?: number;
}) {
  return (
    <Paper variant="outlined" sx={{ p: pad, ...sx }}>
      {title && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: pad }}>
          <Typography variant="h6">{title}</Typography>
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
  return (
    <Chip
      label={children} size="small" onClick={onClick}
      sx={{
        height: 20, fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.02em',
        borderColor: 'transparent',
        bgcolor: tone === 'primary' ? 'rgba(216,27,96,0.10)' : tone === 'err' ? 'rgba(155,18,63,0.10)'
          : tone === 'warn' ? 'rgba(173,20,87,0.10)' : 'action.hover',
        color: tone === 'primary' || tone === 'warn' ? 'primary.main' : tone === 'err' ? 'error.main' : 'text.secondary',
      }}
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
      onChange={(e) => onChange(e.target.value)}
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
    <Dialog
      open={open} onClose={onClose} maxWidth={false} fullWidth
      PaperProps={{ sx: { maxWidth: width, width: '100%', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 32px)' } }}
    >
      <DialogTitle sx={{ pb: 0.5, fontSize: '1rem' }}>
        {title}
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>{subtitle}</Typography>}
      </DialogTitle>
      {/* One scroll area inside the dialog — never two nested scrollbars. */}
      <DialogContent dividers>{children}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

export function Empty({ icon = 'profiles', title, hint, action }: {
  icon?: IconName; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 6, textAlign: 'center' }}>
      <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main' }}>
        <Icon name={icon} size={22} />
      </Box>
      <Typography variant="h6">{title}</Typography>
      {hint && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>{hint}</Typography>}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}

/** Compact inline metric — replaces four heavy cards with one strip. */
export function MetricStrip({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <Paper variant="outlined" sx={{ display: 'flex', flexWrap: 'wrap', px: { xs: 1.5, sm: 2 }, py: 1.1, gap: { xs: 1.5, sm: 3 } }}>
      {items.map((i) => (
        <Box key={i.label} sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{i.label}</Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>{i.value}</Typography>
        </Box>
      ))}
    </Paper>
  );
}

/** Circular score indicator. Flat colour, no gradient. */
export function ScoreRing({ value, size = 34, label }: { value: number; size?: number; label?: string }) {
  const stroke = size <= 36 ? 3.5 : 5;
  const r = (size - stroke - 2) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D81B60" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontSize: size > 50 ? '1rem' : '0.68rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {label ?? Math.round(value)}
        </Typography>
      </Box>
    </Box>
  );
}

/** Page header: title, one-line purpose, primary action. No decorative kicker. */
export function PageHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between" spacing={1.25} sx={{ mb: 1.75 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h2">{title}</Typography>
        {hint && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>{hint}</Typography>}
      </Box>
      {action && <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>{action}</Stack>}
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
      sx={{ bottom: { xs: 78, md: 20 } }}
    >
      <Alert
        severity={t?.kind === 'err' ? 'error' : t?.kind === 'warn' ? 'warning' : t?.kind === 'info' ? 'info' : 'success'}
        onClose={() => t && s.dismissToast(t.id)} sx={{ alignItems: 'center' }}
      >
        {t?.text}
      </Alert>
    </Snackbar>
  );
}

/** @deprecated use PageHead. `kicker` is accepted and deliberately not rendered. */
export function SectionHead({ title, hint, action }: { kicker?: string; title: string; hint?: string; action?: ReactNode }) {
  return <PageHead title={title} hint={hint} action={action} />;
}

/** Compact stat row, kept for views still on the card layout. */
export function StatCard({ icon, label, value, note }: { icon: IconName; label: string; value: ReactNode; note?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.4, display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.09)', color: 'primary.main', flex: 'none' }}>
        <Icon name={icon} size={18} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.25 }}>{value}</Typography>
        {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
      </Box>
    </Paper>
  );
}
