import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/globals.css';
import { notifyAppUpdateAvailable, setAppReloadHandler } from './lib/appUpdate';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    notifyAppUpdateAvailable();
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => registration.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('focus', check);
    setInterval(check, 60 * 60 * 1000);
    check();
  },
});

setAppReloadHandler(() => {
  updateSW(true);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
