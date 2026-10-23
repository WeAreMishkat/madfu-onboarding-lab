import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LabProvider } from './lab/LabContext';
import { LabBar } from './lab/LabBar';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

const TabbyPage = lazy(() => import('./experiences/tabby/TabbyPage'));
const TamaraPage = lazy(() => import('./experiences/tamara/TamaraPage'));
const MadfuCurrentPage = lazy(() => import('./experiences/madfu-current/MadfuCurrentPage'));
const ProposedPage = lazy(() => import('./experiences/proposed/ProposedPage'));
const ComparePage = lazy(() => import('./pages/Compare'));
const PrintWireframes = lazy(() => import('./pages/PrintWireframes'));
const PrintSimpleBoard = lazy(() => import('./pages/PrintWireframes').then((m) => ({ default: m.PrintSimpleBoard })));
const PrintDetailedBoard = lazy(() => import('./pages/PrintWireframes').then((m) => ({ default: m.PrintDetailedBoard })));

const TITLES: Record<string, string> = {
  '/': 'Merchant Onboarding Lab',
  '/tabby': 'Tabby onboarding · Merchant Onboarding Lab',
  '/tamara': 'Tamara onboarding · Merchant Onboarding Lab',
  '/madfu/current': 'Madfu Current onboarding · Merchant Onboarding Lab',
  '/madfu/proposed': 'Madfu Business (proposed) · Merchant Onboarding Lab',
  '/compare': 'Compare experiences · Merchant Onboarding Lab'
};

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname.replace(/\/$/, '') || '/'] ?? 'Merchant Onboarding Lab';
  }, [pathname]);
  return null;
}

export function App() {
  const { pathname } = useLocation();
  // Print-only routes for the PDFs (wireframes, master boards): no Lab chrome.
  if (pathname.startsWith('/print/')) {
    return (
      <LabProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/print/wireframes" element={<PrintWireframes />} />
            <Route path="/print/board-simple" element={<PrintSimpleBoard />} />
            <Route path="/print/board-detailed" element={<PrintDetailedBoard />} />
          </Routes>
        </Suspense>
      </LabProvider>
    );
  }
  return (
    <LabProvider>
      <a className="skip-link" href="#main">Skip to content</a>
      <TitleSync />
      <LabBar />
      <Suspense fallback={<div className="lab-loading" role="status">Loading experience…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tabby" element={<TabbyPage />} />
          <Route path="/tamara" element={<TamaraPage />} />
          <Route path="/madfu" element={<Navigate to="/madfu/proposed" replace />} />
          <Route path="/madfu/current" element={<MadfuCurrentPage />} />
          <Route path="/madfu/proposed" element={<ProposedPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </LabProvider>
  );
}
