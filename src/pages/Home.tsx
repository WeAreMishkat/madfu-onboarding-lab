import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MadfuBusinessLockup, MadfuWordmark, TabbyMark, TamaraMark } from '@/lab/BrandMarks';
import { SCENARIOS } from '@/experiences/proposed/model/scenarios';

const SCENARIO_COUNT = SCENARIOS.length;

interface CardDef {
  to: string;
  kind: string;
  kindClass: string;
  title: string;
  mark: ReactNode;
  description: string;
  facts: string[];
}

const CARDS: CardDef[] = [
  {
    to: '/tabby',
    kind: 'Benchmark Experience',
    kindClass: 'is-benchmark',
    title: 'Tabby',
    mark: <TabbyMark size={30} />,
    description: 'Email-first sign-up with a Unified Number registry lookup that fills legal details for registered businesses.',
    facts: ['Email + phone codes', 'Registry auto-fill (CR)', 'Sales-led route at SAR 20m+ (inferred)']
  },
  {
    to: '/tamara',
    kind: 'Benchmark Experience',
    kindClass: 'is-benchmark',
    title: 'Tamara',
    mark: <TamaraMark size={30} />,
    description: 'Mobile-keyed application with automatic business verification, a Nafath-verified signatory and Lean bank verification.',
    facts: ['Mobile routes first', 'Signatory from registry + Nafath', 'Later steps partly inferred']
  },
  {
    to: '/madfu/current',
    kind: 'Current Experience',
    kindClass: 'is-current',
    title: 'Madfu Current',
    mark: <MadfuWordmark height={28} />,
    description: 'Today’s journey: lead form, SMS code, partnership offer, account and e-mail verification, then document-based KYB.',
    facts: ['Two revenue bands', 'Wathq lookup (CR)', 'PDF uploads for freelancers']
  },
  {
    to: '/madfu/proposed',
    kind: 'Future Experience',
    kindClass: 'is-future',
    title: 'Madfu Proposed',
    mark: <MadfuBusinessLockup height={26} />,
    description: 'Product-design wireframe prototype: one entry page, SMS code, early category screening, Nafath, retrieved certificates and a verified IBAN, then a separate agreement.',
    facts: ['Application, not account', 'Freelancers self-onboard at all revenues', `${SCENARIO_COUNT} scenarios + journey maps`]
  }
];

export function Home() {
  return (
    <main className="home" id="main">
      <section className="home-intro">
        <p className="home-eyebrow">Product review prototype</p>
        <h1 className="home-title">Merchant Onboarding Lab</h1>
        <p className="home-lede">
          Walk four merchant onboarding experiences side by side. Tabby, Tamara and Madfu Current are rebuilt from repository
          evidence only, with every screen labelled Observed, Documented, Inferred or Unknown. Madfu Proposed is the future
          Madfu Business journey.
        </p>
      </section>

      <section className="home-grid" aria-label="Experiences">
        {CARDS.map((c) => (
          <article key={c.to} className={`home-card ${c.kindClass}`}>
            <div className="home-card-mark">{c.mark}</div>
            <p className={`home-kind ${c.kindClass}`}>{c.kind}</p>
            <h2 className="home-card-title">{c.title}</h2>
            <p className="home-card-desc">{c.description}</p>
            <ul className="home-facts">
              {c.facts.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <Link to={c.to} className="home-cta" aria-label={`View experience: ${c.title}`}>
              View Experience
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </article>
        ))}
      </section>

      <section className="home-compare">
        <div>
          <h2>Comparison mode</h2>
          <p>Stages, merchant inputs, automation, branches and verification points for all four experiences, or Madfu Current against Madfu Proposed. No scores, no ranking.</p>
        </div>
        <Link to="/compare" className="home-compare-cta">Open comparison</Link>
      </section>

      <section className="home-guide" aria-label="How to use the Lab">
        <div>
          <h3>Evidence</h3>
          <p>On Tabby, Tamara and Madfu Current, the Evidence control shows the repository records behind each screen. Screenshots with live data are never deployed.</p>
        </div>
        <div>
          <h3>Jump to branch</h3>
          <p>Open a specific branch directly, such as a freelancer at legal details or a registered business above SAR 20m.</p>
        </div>
        <div>
          <h3>Scenarios and System Checks</h3>
          <p>Madfu Proposed has Prototype Controls with every required scenario, simulated backend answers and the internal status the applicant never sees, plus journey maps, decision tables and a wireframes PDF.</p>
        </div>
      </section>

      <footer className="home-foot">
        All businesses, people, numbers and accounts in this Lab are fictional. No production system is called. Competitor flows are simplified for demonstration; their factual behaviour follows private research evidence, and every screen carries its evidence status. Madfu Proposed is a product-design concept.
      </footer>
    </main>
  );
}
