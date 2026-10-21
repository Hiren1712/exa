import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '../lib/utils';

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

// All variants have explicit foreground colors in BOTH themes and interaction states.
const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-700 hover:bg-blue-800 text-white dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-slate-950 border border-blue-700 dark:border-blue-400 shadow-sm shadow-blue-900/15 hover:shadow-md hover:shadow-blue-900/20',
  ghost:
    'bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700 hover:border-blue-400 dark:hover:border-blue-400 hover:text-blue-800 dark:hover:text-white',
  danger:
    'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-700 dark:hover:bg-rose-600 hover:border-rose-700 hover:text-white dark:hover:text-white',
  success:
    'bg-emerald-700 dark:bg-emerald-500 border border-emerald-700 dark:border-emerald-400 text-white dark:text-slate-950 hover:bg-emerald-800 dark:hover:bg-emerald-400 shadow-sm shadow-emerald-800/15',
  gold:
    'bg-amber-600 dark:bg-amber-400 border border-amber-600 dark:border-amber-300 text-slate-950 dark:text-slate-950 hover:bg-amber-500 dark:hover:bg-amber-300 shadow-sm shadow-amber-700/15',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3.5 min-h-10 text-sm rounded-lg gap-1.5',
  md: 'px-4.5 min-h-11 text-sm rounded-xl gap-2',
  lg: 'px-6 min-h-12 text-base rounded-xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      block,
      className,
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'exa-button inline-flex items-center justify-center text-center font-semibold leading-tight',
        'transition-[background-color,color,border-color,box-shadow,transform] duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
        'active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true" className="inline-block size-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : icon}
      {children}
      {iconRight}
    </button>
  ),
);

Button.displayName = 'Button';
