import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { captureInstallPrompt } from './install';
import './styles.css';

captureInstallPrompt();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
