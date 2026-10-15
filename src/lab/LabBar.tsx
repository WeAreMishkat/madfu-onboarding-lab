import { NavLink, useLocation } from 'react-router-dom';
import { useLab } from './LabContext';

const NAV = [
  { to: '/tabby', label: 'Tabby' },
  { to: '/tamara', label: 'Tamara' },
  { to: '/madfu/current', label: 'Madfu Current' },
  { to: '/madfu/proposed', label: 'Madfu Proposed' },
  { to: '/compare', label: 'Compare' }
];

/** Top bar of the Lab itself. Visually separate from the product UIs it frames. */
export function LabBar() {
  const { pathname } = useLocation();
  const { restart, canRestart } = useLab();
  const inExperience = pathname !== '/' && pathname !== '/compare';
  return (
    <header className="lab-bar">
      <NavLink to="/" className="lab-home" aria-label="Merchant Onboarding Lab home">
        <span className="lab-logo" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18"><rect x="1" y="1" width="7" height="7" rx="2" fill="currentColor" /><rect x="10" y="1" width="7" height="7" rx="2" fill="currentColor" opacity=".55" /><rect x="1" y="10" width="7" height="7" rx="2" fill="currentColor" opacity=".55" /><rect x="10" y="10" width="7" height="7" rx="2" fill="currentColor" opacity=".3" /></svg>
        </span>
        <span className="lab-name">Merchant Onboarding Lab</span>
      </NavLink>
      <nav className="lab-nav" aria-label="Experiences">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `lab-nav-link ${isActive ? 'is-active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="lab-bar-right">
        {inExperience && canRestart && (
          <button type="button" className="lab-bar-btn" onClick={restart}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 105-5H5.5M5.5 1v3h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Restart
          </button>
        )}
        <span className="lab-mock-tag" title="Every business, person, number and account in this Lab is fictional.">Mock data only</span>
      </div>
    </header>
  );
}
