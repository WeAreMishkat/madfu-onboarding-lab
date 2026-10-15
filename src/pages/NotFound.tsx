import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main className="home" id="main">
      <section className="home-intro">
        <p className="home-eyebrow">404</p>
        <h1 className="home-title">This page isn’t part of the Lab</h1>
        <p className="home-lede">The address may be mistyped. Every experience is reachable from the home page.</p>
        <p style={{ marginTop: 24 }}>
          <Link to="/" className="home-compare-cta">Back to the Lab</Link>
        </p>
      </section>
    </main>
  );
}
