import React, { useMemo } from 'react';
import { App } from './App';
import { LandingPage } from './components/LandingPage';

export const RootShell: React.FC = () => {
  const isNativeTauriApp = useMemo(() => {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }, []);

  if (isNativeTauriApp) {
    return <App />;
  }

  return <LandingPage />;
};
