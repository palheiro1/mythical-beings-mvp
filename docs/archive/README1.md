# Mythical Beings PvP Card Game – MVP

## 🔥 Project Summary

A 1v1 online card game inspired by the physical *Mythical Beings* board game. Players connect a crypto wallet, select 3 NFT Creatures (ERC-1155), and battle in turn-based matches using shared Knowledge cards (Spells and Allies). The game ends when a player’s Power reaches 0.

**Goal:** Build a playable digital prototype with minimal UI, focusing on wallet connection, NFT retrieval, basic matchmaking, game loop, and rule enforcement.

**Target Platform:** Web (mobile-responsive; no native app for MVP).

---

## ✅ MVP Deliverables

- Minimal, functional web UI (React, TypeScript)
- Wallet connection (MetaMask or WalletConnect)
- NFT (ERC-1155) verification and selection (mock data for MVP)
- Game state management (Supabase for multiplayer sync)
- Core game logic (deterministic, based on board game rules)
- Two-player match with shared Knowledge market, turn-taking, and Creature rotation
- Complete game loop (match start to victory)
- Off-chain logic only (no blockchain writes)

---

## 🧱 Tech Stack

| Purpose           | Technology                    |
|-------------------|------------------------------|
| Frontend          | React (Vite, TypeScript)      |
| Authentication    | Clerk (Web3 via MetaMask/WalletConnect) |
| Game State + Sync | Supabase (Postgres + Realtime)|
| NFT Data Fetching | Ethers.js (mock data for MVP) |
| Backend Logic     | Supabase Edge Functions (Optional, for game logic validation) |
| UI Styling        | Tailwind CSS                  |
| Testing           | Vitest                        |

> **Setup:**
> - Scaffold with `Vite` (React + TypeScript).
> - Install: `@clerk/clerk-react`, `@supabase/supabase-js`, `ethers`, `tailwindcss`, `vitest`.
> - Configure Clerk for Web3 authentication and Supabase JWT template.

---

## 🗂️ Folder Structure

```
/mythical-beings-mvp
├── public/                  # Static assets (card images, favicon)
├── src/
│   ├── assets/              # Card images, JSON data
│   │   ├── creatures.json   # Mock Creature NFT data
│   │   └── knowledges.json  # Mock Knowledge card data
│   ├── components/          # Reusable UI components
│   │   ├── Card.tsx         # Card display (Creature/Knowledge)
│   │   ├── Hand.tsx         # Player hand UI
│   │   ├── Market.tsx       # Shared Knowledge market UI
│   │   └── CreatureZone.tsx # Creature play area
│   ├── game/                # Game logic (isolated, testable)
│   │   ├── types.ts         # TypeScript interfaces (Card, GameState, Action)
│   │   ├── rules.ts         # Core rule enforcement
│   │   ├── actions.ts       # Action handlers (rotate, draw, summon)
│   │   └── state.ts         # Game state management
│   ├── pages/               # Route-based screens
│   │   ├── Home.tsx         # Landing + Clerk sign-in
│   │   ├── Lobby.tsx        # Matchmaking
│   │   ├── NFTSelection.tsx # NFT selection
│   │   └── GameScreen.tsx   # Main game interface
│   ├── utils/
│   │   ├── nft.ts           # Mock NFT fetcher (Ethers.js stub)
│   │   ├── supabase.ts      # Supabase client setup (with Clerk JWT integration)
│   │   └── clerk.ts         # Clerk client setup (optional, often handled by provider)
│   ├── App.tsx              # Main app with routing & ClerkProvider
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind CSS imports
├── tests/                   # Unit tests
│   ├── rules.test.ts        # Rule engine tests
│   └── state.test.ts        # Game state tests
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind setup
├── tsconfig.json            # TypeScript config
├── package.json
└── README.md
```

> **Setup:**  
> - Scaffold with `Vite`.  
> - Generate empty files for each `.tsx` and `.ts` listed.  
> - Use TypeScript strict mode in `tsconfig.json`.  
> - Initialize Tailwind CSS with `index.css`.

---

## 🧠 Game Logic Overview

**Each player starts with:**
- 3 Creature cards (mock ERC-1155 NFTs)
- 20 Power points

A **shared Knowledge market** displays 5 face-up cards (Spells/Allies) from a common deck.

### Turn Phases

1. **Knowledge Phase** (auto-resolved):
   - Execute effects of all summoned Knowledge cards in play.
   - Rotate each Knowledge card 90º counterclockwise.
   - Discard any Knowledge card that has no visible action or has rotated 360º.

2. **Action Phase**:
   - Player performs **exactly two actions**, choosing from:
     - **Rotate a Creature:** Increase its Wisdom by 1.
     - **Draw a Knowledge card:** Add from market to hand (max hand size: 5).
     - **Summon a Knowledge card:** Play from hand to a Creature (requires Creature’s Wisdom ≥ card cost; 1 Knowledge per Creature).
   - Actions cannot be skipped.

**Victory Condition:**  
The first player to reduce their opponent’s Power to **0** wins.

> **Implementation:**  
> - `rules.ts`: Enforce turn phases, action limits, and win conditions.  
> - `types.ts`: Define interfaces for `Creature`, `Knowledge`, `GameState`, and `Action`.

---

## 📄 Mock NFT and Card Data

### Creature Cards (NFTs)

`src/assets/creatures.json`:
```json
[
  {
    "id": "galapago",
    "name": "Galapago",
    "element": "water",
    "passiveAbility": "On defeat: Gain 1 extra action next turn",
    "image": "/images/galapago.png",
    "baseWisdom": 0
  },
  {
    "id": "skywing",
    "name": "Skywing",
    "element": "air",
    "passiveAbility": "On rotate: Gain 1 Power",
    "image": "/images/skywing.png",
    "baseWisdom": 0
  }
]
```

### Knowledge Cards (Spells/Allies)

`src/assets/knowledges.json`:
```json
[
  {
    "id": "fireball",
    "type": "spell",
    "name": "Fireball",
    "cost": 2,
    "effect": "Deal 3 damage to opponent’s Power",
    "image": "/images/fireball.png"
  },
  {
    "id": "guardian",
    "type": "ally",
    "name": "Guardian",
    "cost": 1,
    "effect": "Prevent 2 damage this turn",
    "image": "/images/guardian.png"
  }
]
```

> **Note:**  
> - Provide at least 5 entries each for creatures and knowledges.  
> - Create `Card.tsx` to render cards dynamically from these JSONs.

---

## ⚠️ Important: Use Real Card Assets

> **Note:**
> For all card data (creatures and spells/knowledges), use the real card images and names found in the `/cards/beings/` and `/cards/spells/` folders instead of the mock data shown in earlier examples.
>
> - **Creature cards:** `/cards/beings/` (e.g., `adaro.jpg`, `caapora.jpg`, `dudugera.jpg`, ...)
> - **Spell/Knowledge cards:** `/cards/spells/` (e.g., `aerial1.jpg`, `aquatic2.jpg`, `terrestrial5.jpg`, ...)
>
> When creating `creatures.json` and `knowledges.json`, list each real card with its filename as the `image` property (e.g., `"/cards/beings/adaro.jpg"`).
>
> **Do not use the mock card names or images from the README or TODO.**
>
> You may list the real card filenames for reference, or automate the JSON generation from the folder contents.

---

## 🗄️ Supabase Schema

| Table        | Columns                                                                 | Notes                                     |
|--------------|------------------------------------------------------------------------|-------------------------------------------|
| games        | id (uuid), player1_id (text), player2_id (text), state (jsonb), created_at (timestamp) | `player_id` references Clerk User ID |
| game_states  | game_id (uuid), turn (int), state (jsonb), updated_at (timestamp)      |                                           |
| moves        | game_id (uuid), player_id (text), action (text), payload (jsonb), timestamp (timestamp) | `player_id` references Clerk User ID |
| ~~users~~    | ~~(uuid), wallet_address (text), username (text)~~                     | **Removed:** User data managed by Clerk   |

> **supabase.ts:**
> - Initialize Supabase client
> - Configure Supabase client to use JWT from Clerk session.
> - Create/join a game (`games` table)
> - Update game state (`game_states` table)
> - Log moves (`moves` table)
> - Use Supabase Realtime for state sync
> - Implement RLS policies based on `auth.uid()` (Clerk User ID) from the JWT.

---

## 🎮 Game Flow

1.  **Home.tsx:** User lands, signs in/up using Clerk (Web3 wallet).
2.  **NFTSelection.tsx:** Fetches mock Creature NFTs (`nft.ts`), selects 3 Creatures.
3.  **Lobby.tsx:** Enters lobby to create/join a match (associates Clerk user ID with player slot).
4.  **GameScreen.tsx:** Game starts:
    - Each player has 3 Creatures, 20 Power.
    - Shared Knowledge market with 5 cards.
    - Turn loop: Knowledge Phase (auto), Action Phase (2 actions), check win condition.
    - Display winner.

> **App.tsx:**
> - Wrap the app with ClerkProvider.
> - Set up React Router for navigation between Home, Lobby, NFTSelection, and GameScreen.
> - Use Clerk hooks (`useAuth`, `useUser`) for authentication state and user info.
> - Implement game loop in GameScreen.tsx using hooks and Supabase subscriptions (authenticated via Clerk JWT).

---

## 🚫 Non-Goals for MVP

- No blockchain writes
- No animations or complex visuals
- No full NFT collection logic
- No ranked matchmaking (basic lobby only)
- No complex user profile management beyond Clerk basics

---

## 🏁 Priority Tasks (Execution Order)

1.  **Scaffold Project:**
    - Use Vite for React + TypeScript
    - Set up Tailwind CSS, `@clerk/clerk-react`, Supabase, and Vitest

2.  **Configure Clerk & Supabase:**
    - Set up Clerk application, enable Web3 authentication.
    - Configure Clerk JWT template for Supabase compatibility.
    - Set up Supabase project and database schema (excluding `users` table).
    - Configure Supabase Auth JWT verification to use Clerk's keys.

3.  **Implement Authentication Flow:**
    - Integrate ClerkProvider and sign-in components/hooks in `App.tsx` and `Home.tsx`.
    - Configure `supabase.ts` to use Clerk's JWT for authenticated requests.

4.  **Mock Data:**
    - Create `creatures.json` and `knowledges.json`
    - Stub `nft.ts` for mock NFT fetching

5.  **Game Logic:**
    - Implement `types.ts`, `rules.ts`, `actions.ts`, `state.ts`
    - Write unit tests in `rules.test.ts` and `state.test.ts`

6.  **UI Components:**
    - Build `Card.tsx`, `Hand.tsx`, `Market.tsx`, `CreatureZone.tsx`
    - Create `Home.tsx`, `NFTSelection.tsx`, `Lobby.tsx`, `GameScreen.tsx`

7.  **Multiplayer Sync:**
    - Implement game creation, joining, and real-time updates using authenticated Supabase client.
    - Implement RLS policies in Supabase.

8.  **Game Loop:**
    - Enforce turn phases and win conditions
    - Test full match locally (hot-seat mode)

9.  **Polish:**
    - Ensure mobile-responsive UI with Tailwind
    - Debug multiplayer sync issues

> **Tip:**
> - Commit changes after each task for version control.

---

## 🧪 Testing

- **Unit Tests (`tests/`):**
  - `rules.test.ts`: Test action validation, phase transitions (≥3 cases)
  - `state.test.ts`: Test game state updates, win conditions (≥3 cases)

- **Manual Testing:**
  - Simulate full match in hot-seat mode
  - Test multiplayer via Supabase Realtime

- **Edge Cases:**
  - Handle invalid actions (e.g., summon without enough Wisdom)
  - Test full hand (5 cards) and market refill

> **Vitest:**  
> - Generate setup and skeleton test files for `rules.test.ts` and `state.test.ts`.

---

## 📝 Final Notes

- Keep logic deterministic and modular for future blockchain integration.
- Use TypeScript for type safety.
- Comment code with `@cursor` tags where AI assistance is needed (e.g., `// @cursor: Generate action validation logic`).
- Prioritize simplicity over polish for MVP.

> **If any section is unclear, prompt for clarification before generating code.**  
> **Save generated files in the specified folder structure.**



