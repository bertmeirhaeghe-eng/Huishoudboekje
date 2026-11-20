import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './lib/install.js';
import { reloadOnce } from './lib/reload.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Een scherm van een oudere versie kon niet geladen worden (de app werd intussen bijgewerkt): één keer herladen.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnce()) e.preventDefault();
});
