// Import polyfills first to ensure they're available globally
import './polyfills.js';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Ensure index.css is imported
import App from './App.js'; // Add .js extension
import Moralis from 'moralis';

// Import test functions for debugging
import { testNavigationFix, triggerNavigationTest } from './utils/testNavigationFix.js';
import { simulateNavigationBug } from './utils/simulateNavigationTest.js';
import { checkNavigationState, forceNavigationTest, testCompleteGameFlow, resetGameToSelectionPhase } from './utils/navigationDebug.js';
import { testNavigationBugFix, verifyEnumValues } from './utils/testNavigationFinal.js';
import { runComprehensiveNavigationTest, quickNavigationTest } from './utils/finalNavigationTest.js';
import './utils/testCompleteFix.js';
import './utils/testCompleteFlow.js';
import './utils/testRealCreatures.js'; // Import real creature testing functions
import './utils/testRaceConditionFix.js'; // Import race condition fix test

// Import debug functions
import './utils/debugGameState.js';

// Expose test functions globally for browser console access
(window as any).testNavigationFix = testNavigationFix;
(window as any).triggerNavigationTest = triggerNavigationTest;
(window as any).simulateNavigationBug = simulateNavigationBug;
(window as any).checkNavigationState = checkNavigationState;
(window as any).forceNavigationTest = forceNavigationTest;
(window as any).testCompleteGameFlow = testCompleteGameFlow;
(window as any).resetGameToSelectionPhase = resetGameToSelectionPhase;
(window as any).testNavigationBugFix = testNavigationBugFix;
(window as any).verifyEnumValues = verifyEnumValues;
(window as any).runComprehensiveNavigationTest = runComprehensiveNavigationTest;
(window as any).quickNavigationTest = quickNavigationTest;

// Initialize Moralis only if API key is available
if (import.meta.env.VITE_MORALIS_API_KEY) {
  Moralis.start({ apiKey: import.meta.env.VITE_MORALIS_API_KEY });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
