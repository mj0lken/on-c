import React, { useMemo } from 'react';
import { App } from './App';
import { LandingPage } from './components/LandingPage';

export const RootShell: React.FC = () => {
  const isStandaloneApp = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if ('__TAURI_INTERNALS__' in window) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'app';
  }, []);

  if (isStandaloneApp) {
    return <App />;
  }

  return <LandingPage />;
};
