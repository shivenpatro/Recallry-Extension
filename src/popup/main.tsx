import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupApp } from './PopupApp';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DialogProvider } from '../components/DialogProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><DialogProvider><PopupApp /></DialogProvider></ErrorBoundary>
  </React.StrictMode>
);
