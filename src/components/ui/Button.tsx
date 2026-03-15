import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Makes the button fill its container width */
  fullWidth?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50',
  outline:   'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50',
  ghost:     'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50',
  danger:    'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:bg-red-300',
};

const SIZE: Record<ButtonSize, string> = {
  xs: 'text-xs  font-medium  px-2.5 py-1.5  rounded-lg  min-h-[30px] gap-1',
  sm: 'text-xs  font-medium  px-3   py-2    rounded-xl  min-h-[36px] gap-1.5',
  md: 'text-sm  font-medium  px-4   py-2.5  rounded-xl  min-h-[44px] gap-2',
  lg: 'text-sm  font-semibold px-5  py-3.5  rounded-xl  min-h-[52px] gap-2',
};

export function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center select-none',
        'transition-all duration-150',
        'active:scale-[0.97]',
        'disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading
        ? <Loader2 size={16} className="animate-spin flex-shrink-0" />
        : iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
      {children}
      {!loading && iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
}
