import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Chip — selectable label / tag / filter element.
 *
 * Supports:
 *  - selected state with custom active colour (hex)
 *  - leading colour dot (for condition identification)
 *  - two shapes: pill (rounded-full) and rect (rounded-xl)
 *  - two sizes: sm (compact) and md (default)
 *
 * Usage:
 *  <Chip selected={active} activeColor={condition.color} onClick={…}>Migraine</Chip>
 *  <Chip selected={on} dotColor={c.color} size="sm" onClick={…}>{c.name}</Chip>
 */
interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  selected?:    boolean;
  /** Hex colour used for the chip background when selected */
  activeColor?: string;
  /** Hex colour for the leading dot */
  dotColor?:    string;
  onClick?:     () => void;
  size?:        'sm' | 'md';
  /** pill = fully rounded (default). rect = rounded-xl corners */
  shape?:       'pill' | 'rect';
  children:     ReactNode;
}

export function Chip({
  selected      = false,
  activeColor,
  dotColor,
  onClick,
  size          = 'md',
  shape         = 'pill',
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ChipProps) {
  const sizeClass = size === 'sm'
    ? 'px-2.5 py-1 text-xs  min-h-[28px] gap-1.5'
    : 'px-3.5  py-2 text-sm min-h-[36px] gap-2';

  const shapeClass = shape === 'rect' ? 'rounded-xl' : 'rounded-full';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center font-medium border transition-all',
        'active:scale-[0.95] select-none disabled:cursor-not-allowed disabled:opacity-50',
        sizeClass,
        shapeClass,
        selected
          ? 'border-transparent text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        className,
      )}
      style={
        selected && activeColor
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : undefined
      }
      {...rest}
    >
      {dotColor && (
        <span
          className="flex-shrink-0 rounded-full"
          style={{
            width:  size === 'sm' ? 7 : 8,
            height: size === 'sm' ? 7 : 8,
            backgroundColor: dotColor,
          }}
        />
      )}
      {children}
    </button>
  );
}
