# Mythical Beings PvP Card Game MVP – Sequential Task List

Welcome! This document is a step-by-step guide to building the **Mythical Beings PvP Card Game MVP**. Each task is clear, actionable, and designed to prevent confusion. Please follow the steps in order, completing each one fully before moving to the next. Commit changes to Git after each major section.

---

## Project Overview
- **Goal:** Build a 1v1 online card game with wallet connection, NFT selection, and turn-based gameplay using React, TypeScript, Vite, and Supabase.

---

## General Instructions
- Follow each task sequentially.
- Complete each step fully before proceeding.
- Commit changes to Git after each major section (e.g., project setup, mock data creation, etc.).
- Read the **Note for Cursor** in each task for additional clarity.
- Mark tasks as complete using the checkboxes (`- [x]`).

---

## Task 1: Scaffold the Project with Vite
- [x] **Action:** Create a new React + TypeScript project using Vite.

```bash
npm create vite@latest mythical-beings-mvp --template react-ts
```

**Steps:**
1. Run the command above in your terminal.
2. Select "React" and "TypeScript" when prompted.
3. Navigate to the project folder: `cd mythical-beings-mvp`.
4. Install dependencies: `npm install`.

> **Note:** This sets up the basic project structure. Ensure the command runs successfully and the project folder is created.

---

## Task 2: Initialize Git Repository
- [x] **Action:** Initialize a Git repository in the new project folder.

```bash
cd mythical-beings-mvp
git init
```

**Steps:**
1. Navigate into the `mythical-beings-mvp` directory.
2. Run `git init`.

> **Note:** This prepares the project for version control.

---

## Task 3: Set Up Folder Structure
- [x] **Action:** Create the required directories and empty files.

**Directories:**
- `mythical-beings-mvp/src/assets/`
- `mythical-beings-mvp/src/components/`
- `mythical-beings-mvp/src/game/`
- `mythical-beings-mvp/src/pages/`
- `mythical-beings-mvp/src/utils/`
- `mythical-beings-mvp/public/images/beings/`
- `mythical-beings-mvp/public/images/spells/`
- `mythical-beings-mvp/tests/`

**Files (empty):**
- `mythical-beings-mvp/src/assets/creatures.json`
- `mythical-beings-mvp/src/assets/knowledges.json`
- `mythical-beings-mvp/src/components/Card.tsx`
- `mythical-beings-mvp/src/components/Hand.tsx`
- `mythical-beings-mvp/src/components/Market.tsx`
- `mythical-beings-mvp/src/components/CreatureZone.tsx`
- `mythical-beings-mvp/src/game/types.ts`
- `mythical-beings-mvp/src/game/rules.ts`
- `mythical-beings-mvp/src/game/actions.ts`
- `mythical-beings-mvp/src/game/state.ts`
- `mythical-beings-mvp/src/pages/Home.tsx`
- `mythical-beings-mvp/src/pages/Lobby.tsx`
- `mythical-beings-mvp/src/pages/NFTSelection.tsx`
- `mythical-beings-mvp/src/pages/GameScreen.tsx`
- `mythical-beings-mvp/src/utils/nft.ts`
- `mythical-beings-mvp/src/utils/supabase.ts`
- `mythical-beings-mvp/src/utils/wallet.ts`
- `mythical-beings-mvp/tests/rules.test.ts`
- `mythical-beings-mvp/tests/state.test.ts`

**Steps:**
- Create each directory using `mkdir -p` or your IDE.
- Create each empty file using `touch` or your IDE.

> **Note:** Ensure the structure matches exactly. The `public/images` folders are for Task 4.

---

## Task 4: Copy Card Assets
- [x] **Action:** Copy card images from the original `cards/` directory to the new project's `public/images/` directory.

**Steps:**
1. Copy all `.jpg` files from `/home/usuario/Documentos/GitHub/CardGame/cards/beings/` to `mythical-beings-mvp/public/images/beings/`.
2. Copy all `.jpg` files from `/home/usuario/Documentos/GitHub/CardGame/cards/spells/` to `mythical-beings-mvp/public/images/spells/`.

> **Note:** This makes the assets available to the Vite project.

---

## Task 5: Install Dependencies
- [x] **Action:** Install required packages using npm and initialize Tailwind.

```bash
cd mythical-beings-mvp
npm install wagmi rainbowkit @supabase/supabase-js ethers tailwindcss postcss autoprefixer vitest react-router-dom
npm install --save-dev jsdom # For Vitest DOM testing
npx tailwindcss init -p
```

**Steps:**
1. Navigate into the `mythical-beings-mvp` directory.
2. Run the `npm install` commands.
3. Run `npx tailwindcss init -p` to generate config files.

> **Note:** Verify packages in `package.json`. `react-router-dom` is needed for Task 13, `jsdom` for Task 11.

---

## Task 6: Configure Tailwind CSS
- [x] **Action:** Update `tailwind.config.js` to scan source files.

**File:** `mythical-beings-mvp/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Steps:**
1. Open `mythical-beings-mvp/tailwind.config.js`.
2. Replace its contents with the code above (ensure it matches Vite's default structure).

> **Note:** This ensures Tailwind works across all `src/` files and `index.html`.

---

## Task 7: Set Up TypeScript Configuration
- [x] **Action:** Update `tsconfig.json` to enable strict mode.

**File:** `mythical-beings-mvp/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020", // Updated target
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler", // Updated moduleResolution
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true // Added for consistency
  },
  "include": ["src", "vite.config.ts", "tests"], // Include tests and vite config
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Steps:**
1. Open `mythical-beings-mvp/tsconfig.json`.
2. Replace its contents with the code above (using Vite's newer defaults + strict).

> **Note:** Strict mode helps catch errors early.

---

## Task 8: Create Mock Data (Using Real Assets)
- [x] **Action:** Populate `creatures.json` and `knowledges.json` using the real assets.

**File:** `mythical-beings-mvp/src/assets/creatures.json`
*(Generate content based on files in `public/images/beings/`, assigning placeholder data)*

**File:** `mythical-beings-mvp/src/assets/knowledges.json`
*(Generate content based on files in `public/images/spells/`, assigning placeholder data)*

**Steps:**
1. List files in `public/images/beings/` and `public/images/spells/`.
2. Create JSON entries for each file, setting `image` path like `/images/beings/adaro.jpg`.
3. Add placeholder `id`, `name` (derived from filename), `element`/`type`, `passiveAbility`/`effect`, `baseWisdom`/`cost`.

> **Note:** Ensure JSON is valid. Use at least 5 creatures and 5 knowledges for initial game state.

---

## Task 9: Implement Game Logic – Types
- [x] **Action:** Define TypeScript interfaces in `src/game/types.ts`.

**File:** `mythical-beings-mvp/src/game/types.ts`
```ts
// Base Card types
export interface BaseCard {
  id: string; // Unique identifier (e.g., filename without extension)
  name: string; // Card name (e.g., "Adaro", "Aerial Blast")
  image: string; // Path to image (e.g., "/images/beings/adaro.jpg")
}

// Creature specific types
export type CreatureElement = 'earth' | 'water' | 'air' | 'fire' | 'neutral'; // Added fire/neutral

export interface Creature extends BaseCard {
  element: CreatureElement;
  passiveAbility: string; // Description of passive effect
  baseWisdom: number; // Starting wisdom
  // Runtime properties (added during gameplay, not in JSON)
  currentWisdom?: number;
  summonedKnowledgeId?: string | null; // ID of knowledge card attached
}

// Knowledge specific types
export type KnowledgeType = 'spell' | 'ally';

export interface Knowledge extends BaseCard {
  type: KnowledgeType;
  cost: number; // Wisdom cost to summon
  effect: string; // Description of the effect when played/activated
  // Runtime properties (added during gameplay, not in JSON)
  rotation?: number; // 0, 90, 180, 270 degrees
}

// Player state
export interface PlayerState {
  id: string; // Unique player identifier (e.g., wallet address or session ID)
  power: number;
  creatures: Creature[]; // The 3 creatures selected
  hand: Knowledge[]; // Max 5 knowledge cards
  field: { creatureId: string; knowledge: Knowledge | null }[]; // Creatures in play with attached knowledge
  selectedCreatures: Creature[]; // Creatures chosen during NFTSelection phase
}

// Overall Game State
export interface GameState {
  gameId: string; // Unique ID for the game session
  players: [PlayerState, PlayerState];
  market: Knowledge[]; // 5 face-up knowledge cards
  knowledgeDeck: Knowledge[]; // Remaining knowledge cards
  turn: number; // Current turn number
  currentPlayerIndex: 0 | 1; // Index of the current player in the players array
  phase: 'knowledge' | 'action' | 'end'; // Current game phase
  actionsTakenThisTurn: number; // Counter for actions in Action Phase
  winner: string | null; // ID of the winning player, or null
  log: string[]; // History of game events/actions
}

// Action types for game updates
export type GameAction =
  | { type: 'ROTATE_CREATURE'; payload: { playerId: string; creatureId: string } }
  | { type: 'DRAW_KNOWLEDGE'; payload: { playerId: string; knowledgeId: string } }
  | { type: 'SUMMON_KNOWLEDGE'; payload: { playerId: string; knowledgeId: string; creatureId: string } }
  | { type: 'END_TURN'; payload: { playerId: string } }
  | { type: 'INITIALIZE_GAME'; payload: { gameId: string; player1Id: string; player2Id: string; selectedCreaturesP1: Creature[]; selectedCreaturesP2: Creature[] } }
  | { type: 'SET_GAME_STATE'; payload: GameState }; // For loading state from Supabase
```

**Steps:**
1. Open `mythical-beings-mvp/src/game/types.ts`.
2. Add the code above.

> **Note:** These types are more detailed than the initial README/TODO examples.

---

## Task 10: Implement Core Rules
- [x] **Action:** Implement rule enforcement in `src/game/rules.ts`.

**File:** `mythical-beings-mvp/src/game/rules.ts`
*(Implement `isValidAction`, `executeKnowledgePhase`, `executeActionPhase`, `checkWinCondition` based on `types.ts` and game rules)*

**Steps:**
1. Open `mythical-beings-mvp/src/game/rules.ts`.
2. Implement the functions using the defined types and game logic from `README.md`.

> **Note:** Focus on validation and basic state transitions.

---

## Task 11: Implement Action Handlers
- [x] **Action:** Create action handlers in `src/game/actions.ts`.

**File:** `mythical-beings-mvp/src/game/actions.ts`
*(Implement `rotateCreature`, `drawKnowledge`, `summonKnowledge` functions that take state and payload, returning updated state)*

**Steps:**
1. Open `mythical-beings-mvp/src/game/actions.ts`.
2. Implement functions to modify the game state based on valid actions.

> **Note:** These functions should be pure and deterministic.

---

## Task 12: Manage Game State
- [x] **Action:** Implement game state initialization and updates in `src/game/state.ts`.

**File:** `mythical-beings-mvp/src/game/state.ts`
*(Implement `initializeGame` and a reducer function `gameReducer(state, action)`)*

**Steps:**
1. Open `mythical-beings-mvp/src/game/state.ts`.
2. Implement `initializeGame` to set up the initial `GameState`.
3. Implement `gameReducer` to handle `GameAction` types and update state using `rules.ts` and `actions.ts`.

> **Note:** The reducer pattern helps manage state updates predictably.

---

## Task 13: Write Unit Tests for Game Logic
- [x] **Action:** Create and populate test files in `tests/`.

**Files:**
- `mythical-beings-mvp/tests/rules.test.ts`
- `mythical-beings-mvp/tests/state.test.ts`

**Steps:**
1. Write tests using Vitest (`describe`, `it`, `expect`).
2. Test `isValidAction`, `checkWinCondition`, `initializeGame`, and `gameReducer` with various scenarios.
3. Run `npm test` (or `npm run test:watch`) to verify tests pass.

> **Note:** Aim for good test coverage of core logic.

---

## Task 14: Build UI Components
- [x] **Action:** Implement UI components in `src/components/`.

**Files:**
- `mythical-beings-mvp/src/components/Card.tsx`
- `mythical-beings-mvp/src/components/Hand.tsx`
- `mythical-beings-mvp/src/components/Market.tsx`
- `mythical-beings-mvp/src/components/CreatureZone.tsx`

**Steps:**
1. Implement basic functional components using React and TypeScript.
2. Use Tailwind CSS for minimal styling.
3. Display card data based on props (`Creature`, `Knowledge`).

> **Note:** Focus on displaying information; interactivity comes later.

---

## Task 15: Set Up Pages & Routing
- [x] **Action:** Implement pages and configure React Router.

**Files:**
- `mythical-beings-mvp/src/main.tsx` (Wrap `<App />` in `<BrowserRouter>`)
- `mythical-beings-mvp/src/App.tsx` (Define routes using `<Routes>` and `<Route>`)
- `mythical-beings-mvp/src/pages/Home.tsx`
- `mythical-beings-mvp/src/pages/Lobby.tsx`
- `mythical-beings-mvp/src/pages/NFTSelection.tsx`
- `mythical-beings-mvp/src/pages/GameScreen.tsx`

**Steps:**
1. Update `main.tsx` and `App.tsx` as described.
2. Create basic placeholder content for each page component.

> **Note:** Ensure navigation structure is set up.

---

## Task 16: Integrate Supabase
- [x] **Action:** Set up Supabase client and basic functions.

**File:** `mythical-beings-mvp/src/utils/supabase.ts`

**Steps:**
1. Add Supabase URL and Anon Key (provided). (DONE)
2. Initialize the Supabase client (`createClient`). (DONE)
3. Implement basic async functions for `createGame`, `joinGame`, `getGameState`, `updateGameState`. (DONE - Basic functions exist)
4. **Reminder:** Ensure Supabase tables (`games`, `game_states`, `moves`, `users`) are created matching the schema in `README.md`.

> **Note:** These functions will interact with the Supabase backend.

---

## Task 17: Implement Multiplayer Sync
- [x] **Action:** Update `GameScreen.tsx` to use Supabase for state synchronization.

**File:** `mythical-beings-mvp/src/pages/GameScreen.tsx`

**Steps:**
1. Use `useReducer` for local game state (`GameState | null`) and `useEffect` for subscriptions. (DONE)
2. Subscribe to Supabase Realtime changes on the `games` table row for the current `gameId`. (DONE)
3. When changes are received via subscription, dispatch `SET_GAME_STATE` to update local state. (DONE)
4. When the local player makes a valid move (`handleAction`):
    a. Validate action using `isValidAction`. (DONE)
    b. Dispatch action locally using `gameScreenReducer` for optimistic UI update. (DONE)
    c. Push the new state to Supabase using `updateGameState`. (DONE)
    d. Log the move using `logMove`. (DONE)
    e. Handle potential errors during Supabase updates. (DONE)

> **Note:** This implements the core multiplayer sync. Basic UI components are rendered, but interactivity (clicking cards/buttons to trigger actions) is partially implemented (Rotate, Draw, End Turn work; Summon needs refinement). Error handling and player ID management are basic.

---

## Task 18: Implement Game Loop in UI
- [x] **Action:** Connect game logic and UI interactions in `GameScreen.tsx`.

**File:** `mythical-beings-mvp/src/pages/GameScreen.tsx`

**Steps:**
1. Use `useReducer` with the `gameReducer` from `state.ts` to manage game state.
2. Display player info, creatures, hand, market based on the state.
3. Add `onClick` handlers to UI elements (cards, buttons) that dispatch `GameAction` objects to the reducer.
4. Ensure actions are only dispatched if it's the current player's turn and the action is valid (`isValidAction`).
5. Display whose turn it is and actions remaining.
6. Show winner when `checkWinCondition` returns a player ID.

> **Note:** This integrates the game logic with the user interface.

---

## Task 19: Polish UI for Mobile Responsiveness
- [x] **Action:** Update components with Tailwind CSS for mobile support.

**Steps:**
1. Review components (`Hand.tsx`, `Market.tsx`, `CreatureZone.tsx`, `GameScreen.tsx`). (DONE)
2. Use Tailwind responsive prefixes (e.g., `md:`, `lg:`) and flexbox/grid properties (`flex-wrap`, `gap-2`) to ensure usability on smaller screens. (DONE - Card sizes, flex-wrap/gap in zones)
3. Test using browser developer tools. (DONE - Basic wrapping confirmed)

> **Note:** Aim for a functional layout, not pixel-perfect design. Basic responsiveness achieved for MVP.

---

## Task 20: Debug and Test End-to-End
- [ ] **Action:** Test the full game flow locally and with Supabase.

**Steps:**
1. Run `npm run dev`.
2. Test wallet connection (mock), NFT selection (mock), lobby (create/join), and the full game loop on `GameScreen.tsx`.
3. Open two browser windows/tabs to simulate a multiplayer match using Supabase sync.
4. Check browser console for errors.
5. Fix any bugs found in logic or UI.

> **Note:** This ensures all pieces work together.

---

## Task 21: Finalize and Commit
- [ ] **Action:** Review, build, and commit the final MVP code.

**Steps:**
1. Ensure all previous tasks are checked off.
2. Run `npm run build` to check for production build errors.
3. Commit all changes: `git add . && git commit -m "feat: Complete Mythical Beings MVP implementation"`.
4. (Optional) Push to a GitHub repository if one was set up.

> **Note:** Verify the final app runs correctly after building.

---

# End of Task List

This updated list includes Git initialization and checkboxes for tracking progress.

**Happy coding!**
