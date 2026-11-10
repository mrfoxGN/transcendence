import './logo-carousel.css';

const logos = [
  ['github', 'GitHub'],
  ['gitlab', 'GitLab'],
  ['vercel', 'Vercel'],
  ['amazon', 'Amazon'],
  ['mongodb', 'MongoDB'],
  ['docker', 'Docker'],
  ['figma', 'Figma'],
  ['postgresql', 'PostgreSQL'],
  ['redis', 'Redis'],
  ['kubernetes', 'Kubernetes'],
];

export function LogoCarousel() {
  return (
    <section className="logo-carousel section-wrap" aria-label="Tools developers use">
      <p className="logo-carousel-caption">Tools developers use</p>
      <div className="logo-carousel-window">
        <div className="logo-carousel-track">
          {[false, true].map(duplicate => (
            <ul className="logo-carousel-group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
              {logos.map(([slug, label]) => (
                <li key={slug}>
                  <img src={`/integration-logos/${slug}.svg`} width="22" height="22" alt="" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
