// A short entry delay avoids accidental opening; a longer exit delay bridges pointer gaps.
export const HOVER_OPEN_DELAY = 200;
export const HOVER_CLOSE_DELAY = 220;

export function supportsHover(pointerType: string) {
  return pointerType === 'mouse' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}
