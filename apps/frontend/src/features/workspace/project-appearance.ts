import type { CSSProperties } from 'react';

/** Stable blue/pink/violet palettes; never introduce green or yellow accents. */
export function projectAppearance(id: string): CSSProperties {
  let hash = 2166136261;
  for (const char of id) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507) >>> 0;
  const hues = [215 + (hash % 31), 260 + ((hash >>> 8) % 31), 305 + ((hash >>> 16) % 31)];
  const start = hash % 3;
  const step = 1 + ((hash >>> 20) % 2);
  const palette = Array.from({ length: 3 }, (_, index) => {
    const hue = hues[(start + index * step) % 3];
    const saturation = 70 + ((hash >>> (index * 6)) % 9);
    const lightness = 76 + ((hash >>> (index * 5 + 3)) % 5);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  });
  return {
    '--folder-dark-blue': `hsl(${hues[start]} 72% 39%)`,
    '--folder-dark-pink': `hsl(${hues[(start + step) % 3]} 66% 37%)`,
    '--folder-dark-accent': `hsl(${hues[(start + 2 * step) % 3]} 70% 42%)`,
    '--project-dark-accent': `hsl(${hues[start]} 74% 70%)`,
    '--folder-blue': palette[0],
    '--folder-pink': palette[1],
    '--folder-accent': palette[2],
    '--project-accent': `hsl(${hues[start]} 65% 69%)`,
    '--folder-position': `${20 + (hash % 50)}%`,
  } as CSSProperties;
}
