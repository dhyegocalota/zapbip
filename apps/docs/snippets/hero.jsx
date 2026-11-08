export const Hero = ({ eyebrow, statement, accent, lead, primary, secondary, children }) => (
  <section className="zapbip-hero">
    <div className="zapbip-hero-copy">
      <span className="zapbip-hero-eyebrow">{eyebrow}</span>
      <p className="zapbip-hero-statement">
        {statement} <span className="zapbip-hero-accent">{accent}</span>
      </p>
      <p className="zapbip-hero-lead">{lead}</p>
      <div className="zapbip-hero-actions">
        <a className="zapbip-button-primary" href={primary.href}>
          {primary.label}
        </a>
        <a className="zapbip-button-secondary" href={secondary.href}>
          {secondary.label}
        </a>
      </div>
    </div>
    <div className="zapbip-hero-visual">{children}</div>
  </section>
);
