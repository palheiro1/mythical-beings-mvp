import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Ensure index.css is imported
import App from './App.js'; // Add .js extension

async function loadDevTools() {
  const [
    navFix,
    simNav,
    navDebug,
    navFinal,
    finalNav,
  ] = await Promise.all([
    import('./devtools/testNavigationFix.js'),
    import('./devtools/simulateNavigationTest.js'),
    import('./devtools/navigationDebug.js'),
    import('./devtools/testNavigationFinal.js'),
    import('./devtools/finalNavigationTest.js'),
  ]);

  // Side-effect-only dev helpers (keep out of production bundles).
  await Promise.all([
    import('./devtools/testCompleteFix.js'),
    import('./devtools/testCompleteFlow.js'),
    import('./devtools/testRealCreatures.js'),
    import('./devtools/testRaceConditionFix.js'),
    import('./devtools/debugGameState.js'),
  ]);

  // Expose test functions globally for browser console access in dev.
  const w = window as any;
  w.testNavigationFix = navFix.testNavigationFix;
  w.triggerNavigationTest = navFix.triggerNavigationTest;
  w.simulateNavigationBug = simNav.simulateNavigationBug;
  w.checkNavigationState = navDebug.checkNavigationState;
  w.forceNavigationTest = navDebug.forceNavigationTest;
  w.testCompleteGameFlow = navDebug.testCompleteGameFlow;
  w.resetGameToSelectionPhase = navDebug.resetGameToSelectionPhase;
  w.testNavigationBugFix = navFinal.testNavigationBugFix;
  w.verifyEnumValues = navFinal.verifyEnumValues;
  w.runComprehensiveNavigationTest = finalNav.runComprehensiveNavigationTest;
  w.quickNavigationTest = finalNav.quickNavigationTest;
}

if (import.meta.env.DEV) {
  loadDevTools().catch((err) => {
    // Don't hard-fail app startup on dev helper issues.
    console.warn('[devtools] Failed to load dev tools:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
