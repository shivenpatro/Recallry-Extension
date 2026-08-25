import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { DashboardApp } from './DashboardApp';
import { ErrorBoundary } from '../components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><DashboardApp /></ErrorBoundary>
  </React.StrictMode>
);
