import { useEffect, useRef, useState } from 'react';
export function notePreviewText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+] |\d+\. )\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[([ xX])\]/g, (_, value) => (value.toLowerCase() === 'x' ? '✓' : '□'));
}
export function NoteCardPreview({ content }: { content: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  const text = notePreviewText(content);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setOverflow(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  return (
    <span className="wu-note-card-excerpt" data-overflow={overflow}>
      <p ref={ref}>{text || 'No content yet.'}</p>
      {overflow && (
        <span className="wu-visually-hidden">Open this note to read the full content.</span>
      )}
    </span>
  );
}
