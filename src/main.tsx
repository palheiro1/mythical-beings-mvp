import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Ensure index.css is imported
import App from './App.js'; // Add .js extension
import { startCloudflareWebAnalytics } from './utils/cloudflareWebAnalytics.js';

startCloudflareWebAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
