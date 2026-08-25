import React from 'react';
import ReactDOM from 'react-dom/client';
import { SnapshotApp } from './SnapshotApp';
import '../styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SnapshotApp />
  </React.StrictMode>
);
