// A small palette of distinct, pleasant colors. Deliberately not tied to any
// specific brand's colors — this is a generic per-subscription identifier,
// not an attempt to imitate a company's actual logo or trademark.
const PALETTE = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#8B5CF6', // violet
  '#14B8A6', // teal
  '#F97316', // orange
  '#84CC16', // lime
];

/** Extracts 1-2 uppercase initials from a subscription name for display in an icon. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Deterministically picks a color from the palette based on the name, so
 * the same subscription name always gets the same color across renders,
 * screens, and app restarts (no randomness, no stored state needed).
 */
export function getColorForName(name: string): string {
  const key = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return PALETTE[hash % PALETTE.length];
}
