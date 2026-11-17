const principles = [
  {
    number: "01",
    title: "Work through each step",
    description:
      "Build understanding through clear, focused reasoning instead of jumping straight to a final answer."
  },
  {
    number: "02",
    title: "Ask why, whenever you need",
    description:
      "Pause on the current idea, ask for clarification, and keep your place in the learning process."
  },
  {
    number: "03",
    title: "Learn from your attempts",
    description:
      "Use mistakes as useful feedback, understand what went wrong, and try again with better insight."
  }
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cogniva home">
          <span className="brand-mark" aria-hidden="true">
            c
          </span>
          <span className="brand-name">cogniva</span>
        </a>

        <a
          className="repository-link"
          href="https://github.com/Olalekanthetech1/cogniva-ai"
          target="_blank"
          rel="noreferrer"
        >
          Follow development
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            A NEW WAY TO LEARN
          </p>

          <h1 id="hero-title">
            Understand the steps.
            <span> Build the skill.</span>
          </h1>

          <p className="hero-description">
            Difficult questions deserve more than a quick answer. Cogniva is
            being built to help university students reason through problems,
            ask better questions, and develop understanding that lasts.
          </p>

          <p className="hero-note">
            One step at a time. At your pace.
          </p>
        </div>

        <aside className="development-card" aria-label="Development status">
          <div className="card-topline">
            <span className="card-icon" aria-hidden="true">
              C
            </span>
            <span className="card-label">COGNIVA / BUILD LOG</span>
          </div>

          <p className="card-status">Currently in development</p>
          <h2>The learning engine comes first.</h2>
          <p className="card-description">
            We are laying the engineering foundation for reliable, guided
            learning before opening the tutoring workspace.
          </p>

          <div className="progress-track" aria-hidden="true">
            <span />
          </div>
          <div className="card-foot">
            <span>Foundation phase</span>
            <span>Phase 0</span>
          </div>
        </aside>
      </section>

      <section className="principles" aria-labelledby="principles-title">
        <div className="section-heading">
          <p className="eyebrow">THE LEARNING EXPERIENCE</p>
          <h2 id="principles-title">Designed around understanding.</h2>
        </div>

        <div className="principle-grid">
          {principles.map((principle) => (
            <article className="principle-card" key={principle.number}>
              <span className="principle-number">{principle.number}</span>
              <h3>{principle.title}</h3>
              <p>{principle.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>© 2026 Cogniva</span>
        <span>Understand More. Think Better.</span>
      </footer>
    </main>
  );
}
