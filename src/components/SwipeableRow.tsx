import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  /** Width of the revealed action area (default 80px) */
  revealWidth?: number;
}

/**
 * SwipeableRow — swipe left to reveal a delete action.
 * Touch-only; no effect on desktop hover/mouse.
 */
export default function SwipeableRow({ children, onDelete, revealWidth = 80 }: Props) {
  const [offset, setOffset] = useState(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDraggingRef.current) return;
    const delta = e.touches[0].clientX - startXRef.current;
    // Only allow left swipe (negative delta), clamp to revealWidth
    const clamped = Math.max(-revealWidth, Math.min(0, delta));
    setOffset(clamped);
  }

  function onTouchEnd() {
    isDraggingRef.current = false;
    // Snap: if pulled more than half the reveal width, lock open; else close
    if (offset < -(revealWidth / 2)) {
      setOffset(-revealWidth);
    } else {
      setOffset(0);
    }
  }

  function handleDelete() {
    setOffset(0);
    onDelete();
  }

  function handleClose() {
    setOffset(0);
  }

  const isOpen = offset <= -(revealWidth / 2);

  return (
    <div className="relative overflow-hidden" onClick={isOpen ? handleClose : undefined}>
      {/* Delete action revealed on left-swipe */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500"
        style={{ width: revealWidth }}
      >
        <button
          onClick={e => { e.stopPropagation(); handleDelete(); }}
          className="flex flex-col items-center gap-1 text-white px-4 py-2 min-h-full w-full justify-center"
          aria-label="Delete entry"
        >
          <Trash2 size={18} />
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      {/* Row content — slides left on swipe */}
      <div
        className="relative bg-white transition-none"
        style={{
          transform: `translateX(${offset}px)`,
          // Use CSS transition only when snapping (not during drag)
          transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
