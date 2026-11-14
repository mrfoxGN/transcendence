import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { Quote } from 'lucide-react';
import './landing-reviews.css';

const columns = [
  [
    ['Frontend developer', 'I can open a task and see the decision behind it before I touch the code.'],
    ['Project lead', 'The backlog gives us a place for ideas that are worth keeping but aren’t ready to build.'],
    ['Designer', 'I share the latest design in the workspace, so the team knows which version to review.'],
  ],
  [
    ['Engineering lead', 'When the board hits its work-in-progress limit, we help finish something before starting more.'],
    ['Backend developer', 'I check the branch and recent commits before picking up where a teammate left off.'],
    ['QA tester', 'The task, the conversation, and the review notes give me the context I need to test a fix.'],
  ],
  [
    ['Product designer', 'We settle questions in chat and save decisions in Notes for whoever needs them next.'],
    ['Software developer', 'The activity feed helps me catch up after a day away. I can see what moved without asking for a recap.'],
    ['Team coordinator', 'I can tell what’s ready, who’s working on it, and which tasks are waiting for review.'],
  ],
];

export function LandingReviews() {
  const viewport = useRef<HTMLDivElement>(null);
  const inView = useInView(viewport, { amount: 0.1 });

  return (
    <section className="landing-reviews section-wrap" aria-labelledby="landing-reviews-title">
      <div className="landing-reviews-frame">
        <header className="github-showcase-heading">
          <h2 id="landing-reviews-title">What teams are saying</h2>
          <p>Illustrative testimonials from fictional DevUP users.</p>
        </header>
        <div className="landing-reviews-viewport" ref={viewport} data-playing={inView}
          tabIndex={0} role="group" aria-label="Sample testimonials">
          {columns.map((reviews) => (
            <div className="landing-reviews-column" key={reviews[0][0]}>
              <div className="landing-reviews-track">
                {[false, true].map((duplicate) => (
                  <div className="landing-reviews-set" key={String(duplicate)} aria-hidden={duplicate || undefined}>
                    {reviews.map(([role, quote]) => (
                      <figure className="landing-review" key={role}>
                        <Quote className="landing-review-quote" size={22} aria-hidden="true" />
                        <blockquote>{quote}</blockquote>
                        <figcaption>{role}<small>Sample review</small></figcaption>
                      </figure>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
