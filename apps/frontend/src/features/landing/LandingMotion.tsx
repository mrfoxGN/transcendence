import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';

// GodUI Container Scroll adapted to frame the live board at its natural height.
export function ContainerScroll({ children }: { children: (ready: boolean) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 86%', 'start 36%'] });
  const rotateX = useSpring(useTransform(scrollYProgress, [0, 1], [24, 0]), { stiffness: 125, damping: 24, mass: 1.1 });
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [.62, 1]), { stiffness: 125, damping: 24, mass: 1.1 });
  useMotionValueEvent(rotateX, 'change', angle => setSettled(Math.abs(angle) < .5));

  return (
    <div ref={ref} className="board-container-scroll" data-slot="container-scroll">
      <motion.div className="board-scroll-frame section-wrap" style={reduced ? undefined : { rotateX, scale }}>
        {children(reduced === true || settled)}
        {!reduced && settled && (
          <span className="board-scroll-beam" aria-hidden="true">
            <span />
          </span>
        )}
      </motion.div>
    </div>
  );
}

function RevealWord({ word, progress, start, end }: {
  word: string; progress: MotionValue<number>; start: number; end: number;
}) {
  const opacity = useTransform(progress, [start, end], [.55, 1]);
  return <motion.span style={{ opacity }}>{word}</motion.span>;
}

// GodUI Scroll Text Reveal adapted for a single paragraph.
export function ScrollTextReveal({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 93%', 'end 55%'] });
  const words = text.split(' ');

  return (
    <p ref={ref} className="landing-scroll-text section-wrap" data-slot="scroll-text-reveal">
      {reduced ? text : <>
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">{words.map((word, index) => (
          <RevealWord key={index} word={word + (index < words.length - 1 ? ' ' : '')}
            progress={scrollYProgress} start={index / words.length} end={(index + 1) / words.length} />
        ))}</span>
      </>}
    </p>
  );
}
