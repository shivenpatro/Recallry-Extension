import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { DashboardApp } from './DashboardApp';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DialogProvider } from '../components/DialogProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><DialogProvider><DashboardApp /></DialogProvider></ErrorBoundary>
  </React.StrictMode>
);
