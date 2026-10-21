import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, icon, rightElement, className, id, 'aria-describedby': describedBy, ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    const feedbackId = `${fieldId}-feedback`;
    return (
      <div className="w-full space-y-1.5">
        {label && <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>}
        <div className="relative">
          {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none">{icon}</div>}
          {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
          <input
            {...rest}
            id={fieldId}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={[describedBy, error || helper ? feedbackId : null].filter(Boolean).join(' ') || undefined}
            className={cn(
              'exa-field w-full px-3.5 py-2.5 text-sm',
              'disabled:bg-slate-100 dark:disabled:bg-slate-800',
              icon && 'pl-10',
              rightElement && 'pr-12',
              error && 'border-rose-500 dark:border-rose-400',
              className,
            )}
          />
        </div>
        {error && <p id={feedbackId} role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        {!error && helper && <p id={feedbackId} className="text-sm text-slate-500 dark:text-slate-400">{helper}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helper, className, id, ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    return (
      <div className="w-full space-y-1.5">
        {label && <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>}
        <textarea
          {...rest}
          id={fieldId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helper ? `${fieldId}-feedback` : undefined}
          className={cn('exa-field w-full px-3.5 py-3 text-sm resize-y min-h-28', error && 'border-rose-500', className)}
        />
        {error && <p id={`${fieldId}-feedback`} role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        {!error && helper && <p id={`${fieldId}-feedback`} className="text-sm text-slate-500 dark:text-slate-400">{helper}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    return (
      <div className="w-full space-y-1.5">
        {label && <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>}
        <select
          {...rest}
          id={fieldId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn('exa-field w-full px-3.5 py-2.5 text-sm cursor-pointer', error && 'border-rose-500', className)}
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
