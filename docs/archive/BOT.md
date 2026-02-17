## Implementation Plan: "Train with a Bot" Feature

### Overview
Add a "Train with a bot" action to the Lobby page, allowing users to play a local, unsaved, leaderboard-exempt game against a simple scripted bot. The bot will perform basic actions (rotate, play, or draw) and the game will not interact with the backend or affect stats.

---

### 1. UI/UX Changes
- In the Lobby "Actions" section, add a new button next to "Create Game":
	- Label: **Train with a bot**
	- On click, start a new local game session against a bot.
- Visually distinguish bot games (e.g., banner, badge, or "vs Bot" in the GameScreen).

### 2. Game State Management
- Create a new game state mode (e.g., `mode: 'bot' | 'online'`) in the game reducer/state.
- When starting a bot game:
	- Initialize game state in memory (not in Supabase DB).
	- Use the same deck/card logic as normal games.
	- Assign player2 as a special bot user (e.g., `{ id: 'bot', username: 'Bot', avatar_url: '/images/bot.png' }`).
- Ensure all game actions, turns, and effects work identically to online games, but are handled locally.

### 3. Bot Logic (Turn Automation)
- On the bot's turn, trigger a function to perform its actions:
	1. **Rotate**: If any of its creatures are not fully rotated, rotate the first such creature.
	2. **Play**: If it has a playable card in hand, play it (pick the first valid one).
	3. **Draw**: If no card can be played, draw a card from the Market.
- Use a small delay (e.g., 500ms-1s) between bot actions for realism.
- Bot logic can be implemented as a utility or as part of the reducer middleware.

### 4. Leaderboard/Stats Exclusion
- Ensure bot games:
	- Are never saved to the database (no Supabase insert/update).
	- Do not trigger any leaderboard/stat updates.
	- Are not visible in the Lobby, Leaderboard, or any online lists.

### 5. Routing & Navigation
- When a bot game is started, navigate to the GameScreen with a special local game state (e.g., via React Router state or a dedicated `/bot-game` route).
- Prevent refresh from breaking the session (optionally, warn or allow restart).

### 6. Testing & Edge Cases
- Add unit tests for bot logic (rotation, play, draw priorities).
- Ensure quitting a bot game returns to the Lobby cleanly.
- Confirm no DB/network calls are made during bot games.

---

### Optional Enhancements
- Allow user to pick starting deck or difficulty for the bot.
- Add more advanced bot strategies in the future.
- Show a summary screen at the end of a bot game.
