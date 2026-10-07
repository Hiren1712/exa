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

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40',
  ghost:
    'bg-transparent border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-500 hover:text-blue-500',
  danger:
    'bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-500 hover:text-white',
  success:
    'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40',
  gold:
    'bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-2xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      loading,
      icon,
      iconRight,
      block,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variantClasses[variant],
          sizeClasses[size],
          block && 'w-full',
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          icon
        )}
        {children}
        {iconRight}
      </button>
    );
  },
);

Button.displayName = 'Button';