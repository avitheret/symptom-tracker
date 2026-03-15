/**
 * Classname utility — merges class strings, filtering falsy values.
 * Keeps zero dependencies (no clsx/classnames needed).
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
