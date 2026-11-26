/** Join optional class names without introducing a styling dependency. */
export function classNames(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}
