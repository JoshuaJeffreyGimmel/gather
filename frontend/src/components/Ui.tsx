import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { initial } from '../format';
import type { PublicUser } from '../types';

/* -------------------------------------------------------------------------
   The verified tick. It never appears on its own — always beside a name, an
   avatar or a sentence that says what was checked.
   ------------------------------------------------------------------------- */

export function Tick({ size = 'sm', className = '' }: { size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  return <span className={`tick tick--${size} ${className}`} aria-hidden="true">✓</span>;
}


/* ------------------------------------------------------------------------- */

export function Avatar({
  user,
  size = 40,
  square = false,
  ring,
  badge = false,
  style
}: {
  user: Pick<PublicUser, 'name' | 'avatar' | 'verified'> | null;
  size?: number;
  square?: boolean;
  /** Colour of the ring that separates overlapping avatars. */
  ring?: string;
  badge?: boolean;
  style?: CSSProperties;
}) {
  const shadow = ring ? `0 0 0 2px ${ring}` : undefined;
  const base: CSSProperties = { width: size, height: size, boxShadow: shadow, ...style };

  const inner = user?.avatar ? (
    <img
      className={`avatar${square ? ' avatar--square' : ''}`}
      src={`/img/${user.avatar}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={base}
    />
  ) : (
    <span
      className="avatar__fallback"
      style={{ ...base, borderRadius: square ? 14 : '50%', fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initial(user?.name ?? '?')}
    </span>
  );

  if (!badge) return inner;
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {inner}
      {user?.verified && <Tick size={size >= 44 ? 'sm' : 'xs'} />}
    </span>
  );
}

export function AvatarStack({
  users,
  size = 26,
  ring = '#fff',
  overlap = -9,
  max = 5,
  badges = false
}: {
  users: Array<Pick<PublicUser, 'id' | 'name' | 'avatar' | 'verified'>>;
  size?: number;
  ring?: string;
  overlap?: number;
  max?: number;
  badges?: boolean;
}) {
  const shown = users.slice(0, max);
  return (
    <div className="stack" style={{ ['--overlap' as string]: `${overlap}px` }}>
      {shown.map((u) =>
        badges ? (
          <span key={u.id} className="avatar-wrap" style={{ width: size, height: size }}>
            <Avatar user={u} size={size} ring={ring} />
            {u.verified && <Tick size="xs" />}
          </span>
        ) : (
          <Avatar key={u.id} user={u} size={size} ring={ring} />
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** One concrete safety sentence per screen — never a generic reassurance. */
export function SafetyNote({ children, tone = 'sand' }: { children: ReactNode; tone?: 'sand' | 'ink' }) {
  return (
    <div className={`safety${tone === 'ink' ? ' safety--ink' : ''}`}>
      <Tick size="sm" />
      <p>{children}</p>
    </div>
  );
}

export function Pill({
  children,
  variant = 'cream',
  tick = false,
  style
}: {
  children: ReactNode;
  variant?: 'cream' | 'ink' | 'tag' | 'glass';
  tick?: boolean;
  style?: CSSProperties;
}) {
  const cls = variant === 'cream' ? 'pill' : `pill pill--${variant}`;
  return (
    <span className={cls} style={style}>
      {tick && <Tick size={variant === 'ink' ? 'xs' : 'sm'} />}
      {children}
    </span>
  );
}

export function VerifiedOnlyPill({ variant = 'cream' }: { variant?: 'cream' | 'ink' }) {
  return (
    <Pill variant={variant} tick>
      Nur verifiziert
    </Pill>
  );
}

/* ------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-pressed={value === o.value}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="switch"
      data-on={on}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        type="button"
        aria-label={`${label} verringern`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 44, height: 44, borderRadius: '50%', background: 'var(--sand)',
          fontSize: 20, lineHeight: 1, color: value <= min ? 'var(--faint)' : 'var(--ink)'
        }}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`${label} erhöhen`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: value >= max ? 'var(--sand)' : 'var(--ink)',
          color: value >= max ? 'var(--faint)' : 'var(--cream)',
          fontSize: 20, lineHeight: 1
        }}
      >
        +
      </button>
    </div>
  );
}

export function Stars({
  value,
  onChange,
  size = 38
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }} role="radiogroup" aria-label="Bewertung">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} von 5 Sternen`}
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          style={{
            fontSize: size,
            lineHeight: 1,
            padding: 0,
            color: value >= n ? 'var(--red)' : '#dfd4c2',
            transition: 'color .14s ease, transform .14s ease',
            cursor: onChange ? 'pointer' : 'default'
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, goal }: { value: number; goal: number }) {
  const pct = Math.max(0, Math.min(100, (value / goal) * 100));
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={goal}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--grey)', flex: 'none' }}>
        {value} von {goal}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

/** The iOS status bar. Cosmetic, but the screens look wrong without it. */
export function StatusBar({ light = false }: { light?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <div className={`statusbar${light ? ' statusbar--light' : ''}`} aria-hidden="true">
      <span>{`${hh}:${mm}`}</span>
      <span className="statusbar__icons">
        <span className="statusbar__bar" />
        <span className="statusbar__battery" />
      </span>
    </div>
  );
}

export function TopFade() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 'calc(66px + env(safe-area-inset-top))',
        // Solid behind the clock, then fading, so scrolled content never
        // collides with the status bar.
        background: 'linear-gradient(180deg, var(--cream) 0 70%, rgba(251,247,241,0) 100%)',
        zIndex: 30,
        pointerEvents: 'none'
      }}
    />
  );
}

export function Spinner({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2.5px solid ${color}`,
        borderTopColor: 'transparent',
        display: 'inline-block',
        animation: 'spin .7s linear infinite'
      }}
    />
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 10, padding: '48px 8px' }}>
      <h3 className="display display--sm" style={{ fontSize: 24 }}>{title}</h3>
      <p className="meta" style={{ maxWidth: 260, lineHeight: 1.5 }}>{body}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
