import { motion, useReducedMotion } from 'framer-motion';
import { Children, type ReactNode } from 'react';

// GodUI Bento Grid, adapted to the landing page's CSS and existing cards.
export function BentoGrid({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="github-stack github-bento"
      data-slot="bento-grid"
      initial={reduced ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {Children.map(children, child => (
        <motion.div data-slot="bento-card" variants={{
          hidden: reduced ? {} : { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 32, stiffness: 320, mass: 0.9 } },
        }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
