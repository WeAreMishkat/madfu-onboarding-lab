import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/lab.css';
import './engine/flow.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* GitHub Pages serves the app under /<repo>/; the router follows Vite's base. */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
