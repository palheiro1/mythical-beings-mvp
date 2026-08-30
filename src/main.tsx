import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Ensure index.css is imported
import App from './App.js'; // Add .js extension
import { AppErrorBoundary } from './components/AppErrorBoundary.js';
import { installGlobalErrorHandlers, startRumCollection } from './utils/telemetry.js';

installGlobalErrorHandlers();
startRumCollection();

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </AppErrorBoundary>,
);
