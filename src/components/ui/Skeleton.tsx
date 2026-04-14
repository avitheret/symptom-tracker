/**
 * Skeleton — animated loading placeholder
 *
 * Usage:
 *   <Skeleton />
 *   <Skeleton className="h-8 w-32" />
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return (
    <div className={`${className} bg-slate-200 rounded-lg animate-pulse`} />
  );
}
