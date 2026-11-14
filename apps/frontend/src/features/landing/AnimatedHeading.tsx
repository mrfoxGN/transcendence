import type { CSSProperties } from 'react';

// GodUI Text Animate's staggered word entrance on a native heading element.
export function AnimatedHeading({ as: Heading, id, lines }: {
  as: 'h1' | 'h3';
  id?: string;
  lines: string[];
}) {
  let index = 0;
  return (
    <Heading id={id} className="animated-heading">
      <span className="sr-only">{lines.join(' ')}</span>
      <span aria-hidden="true">
        {lines.map((line, lineIndex) => (
          <span key={line} className="animated-heading-line">
            {line.split(' ').map((word, wordIndex) => (
              <span key={wordIndex} className="animated-heading-word" style={{ '--word-index': index++ } as CSSProperties}>
                {word}{' '}
              </span>
            ))}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        ))}
      </span>
    </Heading>
  );
}
