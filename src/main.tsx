// Import polyfills first to ensure they're available globally
import './polyfills.js';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Ensure index.css is imported
import App from './App.js'; // Add .js extension
import Moralis from 'moralis';

// Initialize Moralis only if API key is available
if (import.meta.env.VITE_MORALIS_API_KEY) {
  Moralis.start({ apiKey: import.meta.env.VITE_MORALIS_API_KEY });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
