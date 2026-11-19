import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icons';

export function Button({ icon, children, variant = 'ghost', size = 'md', className = '', ...rest }: {
  icon?: IconName; children?: ReactNode; variant?: 'primary' | 'ghost' | 'subtle' | 'danger' | 'outline'; size?: 'sm' | 'md';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, className = '', ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`icon-btn ${className}`} title={label} aria-label={label} {...rest}><Icon name={icon} size={17} /></button>;
}

export function Badge({ children, tone = 'neutral', dot = false }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'err' | 'info' | 'violet'; dot?: boolean }) {
  return <span className={`badge badge-${tone}`}>{dot && <i className="badge-dot" />}{children}</span>;
}

export function Empty({ icon = 'grid', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={24} /></div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function SectionHead({ title, hint, extra }: { title: string; hint?: string; extra?: ReactNode }) {
  return (
    <div className="section-head">
      <div><h2>{title}</h2>{hint && <p>{hint}</p>}</div>
      {extra && <div className="section-actions">{extra}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: IconName }> }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'seg active' : 'seg'} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={14} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

export function Stat({ label, value, icon, tone = 'violet' }: { label: string; value: ReactNode; icon?: IconName; tone?: string }) {
  return (
    <div className="stat">
      {icon && <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={17} /></div>}
      <div><span className="stat-label">{label}</span><strong>{value}</strong></div>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return <div className="progress"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
