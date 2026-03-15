import { type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Sheet — reusable bottom-sheet / modal container.
 *
 * Pattern:
 *   - Mobile:  slides up from the bottom with rounded top corners + drag handle
 *   - Desktop: centered dialog with fully rounded corners
 *
 * Usage:
 *   <Sheet title="Log Symptom" subtitle="Migraine" onClose={onClose}>
 *     <form …> … </form>
 *   </Sheet>
 *
 * The `children` are rendered inside a scrollable body.
 * Include your action-button row (with pb-safe) as the last child.
 */
interface SheetProps {
  title:      string;
  subtitle?:  string;
  /** Small icon node rendered left of the title */
  icon?:      ReactNode;
  onClose:    () => void;
  children:   ReactNode;
  /** Override max width (default: sm:max-w-md) */
  maxWidth?:  string;
}

export function Sheet({
  title,
  subtitle,
  icon,
  onClose,
  children,
  maxWidth = 'sm:max-w-md',
}: SheetProps) {
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      {/* Container */}
      <div
        className={`bg-white w-full ${maxWidth} max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="flex-shrink-0 p-1.5 bg-slate-50 rounded-xl">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 text-base leading-snug">{title}</h2>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 ml-3 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — children handle their own padding */}
        {children}
      </div>
    </div>
  );
}
