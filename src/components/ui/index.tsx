import React, { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, useState } from 'react';
import { Check, Clipboard, LoaderCircle, RefreshCw } from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type Tone = 'default' | 'amber' | 'blue' | 'violet' | 'green' | 'red' | 'muted';

const toneClasses: Record<Tone, string> = {
  default: 'border-white/10 bg-white/[0.04] text-slate-100',
  amber: 'border-amber-300/40 bg-amber-500/10 text-amber-200',
  blue: 'border-cyan-300/35 bg-cyan-500/10 text-cyan-200',
  violet: 'border-violet-300/35 bg-violet-500/10 text-violet-200',
  green: 'border-emerald-300/35 bg-emerald-500/10 text-emerald-200',
  red: 'border-red-300/35 bg-red-500/10 text-red-200',
  muted: 'border-white/10 bg-white/[0.03] text-slate-400',
};

type PanelProps = {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  as?: 'div' | 'section' | 'article';
} & React.HTMLAttributes<HTMLElement>;

export function Panel({ children, className, glow = false, as = 'div', ...props }: PanelProps) {
  const Component = as;
  return (
    <Component className={cn('arena-surface rounded-xl', glow && 'arena-border-glow', className)} {...props}>
      {children}
    </Component>
  );
}

type PageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  fullHeight?: boolean;
};

export function PageShell({ children, className, contentClassName, fullHeight = false }: PageShellProps) {
  return (
    <main className={cn('arena-page text-slate-100', fullHeight ? 'min-h-[calc(100vh-var(--navbar-height))]' : 'min-h-screen', className)}>
      <div className={cn('mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8', contentClassName)}>
        {children}
      </div>
    </main>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'trim-bronze border-amber-300/60 bg-gradient-to-b from-[#f5c766] via-[#d7952b] to-[#8c4f13] text-amber-950 shadow-[0_12px_24px_rgba(0,0,0,0.28)] hover:from-[#ffd77b] hover:to-[#a35d17]',
  secondary:
    'state-arcane shadow-[0_10px_22px_rgba(0,0,0,0.22)] hover:bg-cyan-400/15',
  success:
    'border-emerald-300/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-400/20',
  danger:
    'state-ember hover:bg-red-500/20',
  ghost:
    'border-white/10 bg-white/[0.035] text-slate-200 hover:bg-white/[0.07]',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-13 px-6 py-3 text-base',
};

export interface ArenaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export function ArenaButton({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ArenaButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-bold uppercase tracking-normal transition duration-200 focus:outline-none focus:ring-2 focus:ring-amber-300/40 disabled:opacity-55 disabled:shadow-none',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function StatusBadge({ children, tone = 'default', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-normal', toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function Toast({
  message,
  tone = 'default',
  className,
}: {
  message: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div className={cn('fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl', toneClasses[tone], className)}>
      {message}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-white/[0.06]', className)}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
    </div>
  );
}

export function CopyChip({
  label,
  value,
  className,
}: {
  label?: string;
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn('inline-flex items-center gap-2 rounded-lg border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-left font-mono text-sm text-violet-100 transition hover:border-violet-200/50 hover:bg-violet-500/15', className)}
      aria-label={`Copy ${label || 'value'}`}
      title={`Copy ${value}`}
    >
      {label && <span className="font-sans text-[10px] font-bold uppercase tracking-normal text-violet-200/70">{label}</span>}
      <span className="truncate">{value}</span>
      {copied ? <Check className="h-4 w-4 text-emerald-300" aria-hidden /> : <Clipboard className="h-4 w-4 text-violet-200" aria-hidden />}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('surface-obsidian flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center', className)}>
      <p className="font-display text-xl text-slate-100">{title}</p>
      {description && <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorRecoveryPanel({
  title = 'Something went wrong',
  message,
  onRetry,
  onBack,
  backLabel = 'Back',
}: {
  title?: string;
  message: ReactNode;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <Panel className="mx-auto max-w-xl p-6 text-center" glow>
      <StatusBadge tone="red">Error</StatusBadge>
      <h2 className="mt-4 font-display text-3xl text-slate-100">{title}</h2>
      <p className="mt-3 text-sm text-slate-300">{message}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {onBack && <ArenaButton type="button" variant="ghost" onClick={onBack}>{backLabel}</ArenaButton>}
        {onRetry && <ArenaButton type="button" variant="secondary" icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={onRetry}>Retry</ArenaButton>}
      </div>
    </Panel>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/15',
        props.className,
      )}
    />
  );
}

export function SpinnerEmblem({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid h-20 w-20 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.18)] animate-[arenaPulse_1.8s_ease-in-out_infinite]">
        <LoaderCircle className="h-10 w-10 animate-spin text-cyan-200" aria-hidden />
      </div>
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
  icon,
  subtext,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  subtext?: ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border p-4', toneClasses[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-normal text-slate-400">{label}</p>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-black text-slate-50">{value}</div>
      {subtext && <div className="mt-2 text-xs text-slate-400">{subtext}</div>}
    </div>
  );
}
