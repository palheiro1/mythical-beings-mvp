# Authentication and Profile ID Mismatch - Technical Analysis

## Problem Summary

There's a format mismatch between player IDs in different parts of the application:

- **Frontend**: Uses ETH addresses (`0x...`) directly from Metamask
- **Database**: Stores IDs in UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **Issue**: Comparison failures occur when ETH addresses are directly compared with UUID-formatted IDs

## Key Findings

### Frontend Components
Ok, 
#### 1. NFTSelection.tsx
Two locations with problematic direct ID comparison:

```tsx
// 1. In fetchHandData function (~line 224-233)
const isPlayer1 = gameData.player1_id === currentPlayerId;
const isPlayer2 = gameData.player2_id === currentPlayerId;

if (!isPlayer1 && !isPlayer2) {
  throw new Error("You are not part of this game.");
}

// 2. In handleConfirm function (~line 88-96)
const isPlayer1 = gameData.player1_id === currentPlayerId;
const isPlayer2 = gameData.player2_id === currentPlayerId;

if (!isPlayer1 && !isPlayer2) {
  throw new Error("You are not part of this game (confirmation check).");
}
```

A helper function exists but isn't being used:

```tsx
const isUserPartOfGame = (gameData: any, userId: string) => {
  // Direct ID match
  if (gameData.player1_id === userId || gameData.player2_id === userId) {
    return true;
  }
  
  // Try to match against potential ETH address format
  try {
    const possibleUuid = ethAddressToUUID(userId); 
    return gameData.player1_id === possibleUuid || gameData.player2_id === possibleUuid;
  } catch {
    return false;
  }
};
```

#### 2. usePlayerIdentification.js

- Returns `currentPlayerId` used in comparisons throughout the app
- Currently returns the ETH address format (0x...) instead of UUID format
- Log evidence: `[usePlayerIdentification] Using eth_address from user metadata: 0xE4a2FeD4A2C4FDfE3ddf6EF8cE097c245E1D48c9`

### Backend Functions

#### 1. moralis-auth/index.ts

Contains the critical `ethAddressToUUID` function:

```typescript
function ethAddressToUUID(address: string): string {
  // Remove 0x prefix and ensure lowercase
  const cleanAddress = address.toLowerCase().replace('0x', '');
  
  // Pad or truncate to ensure we have exactly 32 hex characters
  let normalizedHex = cleanAddress;
  if (normalizedHex.length > 32) {
    normalizedHex = normalizedHex.substring(0, 32);
  } else {
    while (normalizedHex.length < 32) {
      normalizedHex += '0';
    }
  }
  
  // Format as UUID
  return [
    normalizedHex.substring(0, 8),
    normalizedHex.substring(8, 12),
    normalizedHex.substring(12, 16),
    normalizedHex.substring(16, 20),
    normalizedHex.substring(20, 32)
  ].join('-');
}
```

Used when generating JWT tokens:

```typescript
const uuidFromAddress = ethAddressToUUID(evmAddress);
// JWT payload creation
const payload = {
  sub: uuidFromAddress, // UUID format used as subject
  user_metadata: {
    eth_address: evmAddress, // Original ETH address stored in metadata
  },
  // ...other fields
};
```

#### 2. create-game/index.ts

Creates games using `effectivePlayerId`:

```typescript
// Processing ID formats
effectivePlayerId = formattedPlayerId || player1Id;

// Creating profile in database
await supabase.from('profiles').upsert({
  id: effectivePlayerId,
  eth_address: player1Id?.startsWith('0x') ? player1Id : null,
  // ...other fields
});

// Creating game with same ID format
await supabase.from('games').insert([{
  id: gameId,
  player1_id: effectivePlayerId,
  // ...other fields
}]);
```

### Database Schema

#### Tables and Fields

**games table**:
| column_name | data_type |
|-------------|-----------|
| id          | uuid      |
| player1_id  | text      |
| player2_id  | text      |
| state       | jsonb     |

**profiles table**:
| column_name | data_type |
|-------------|-----------|
| id          | text      |
| eth_address | text      |

#### RLS Policies

| tablename | policyname | condition |
|-----------|------------|-----------|
| games     | Allow players to update their own games | (auth.uid() = player1_id OR auth.uid() = player2_id) |
| games     | Allow players to view their own games   | (auth.uid() = player1_id OR auth.uid() = player2_id) |

### Log Analysis

Format conversion example:

```
[createGame] Creating game df85cf27-bbd0-4478-b285-365c6718a39c by player 0xE4a2FeD4A2C4FDfE3ddf6EF8cE097c245E1D48c9 (using ID: e2fe29d2-8f51-41c2-81e6-45a89f46cea5) with bet 1
```

This shows the format conversion:

```
ETH address: 0xE4a2FeD4A2C4FDfE3ddf6EF8cE097c245E1D48c9
UUID format: e2fe29d2-8f51-41c2-81e6-45a89f46cea5
```

Error Messages:
- Creator: "Error fetching dealt hand: Error: You are not part of this game."
  - Triggered by direct comparison in `fetchHandData`
- Second player: "Error joining game: Unknown error"
  - Likely related to the same issue in join logic

### Missing Components to Examine

- **usePlayerIdentification.js** implementation (highest priority)
  - Need to see how it processes the ETH address and whether it returns the raw or UUID format
- **utils/supabase.js**
  - Need to examine how it handles authentication and session state
- Any **AuthContext** providers
  - May be centralizing the auth state and ID conversions

## Recommended Fix Strategy

- Use the `isUserPartOfGame` helper function consistently for all player ID checks
- Ensure `ethAddressToUUID` is properly imported and used where needed
- Consider centralizing ID format conversion to avoid inconsistencies

## Simple Solution

The most straightforward and robust solution is to ensure that `currentPlayerId` obtained from `usePlayerIdentification.js` is consistently in the UUID format. This aligns with the format used in the database (`games.player1_id`, `games.player2_id`) and RLS policies (`auth.uid()`).

**Steps:**

1.  **Modify `usePlayerIdentification.js`:**
    *   Import the `ethAddressToUUID` function (or ensure it's accessible, potentially by moving `ethAddressToUUID` to a shared utility module if it's currently only in `moralis-auth/index.ts` and `usePlayerIdentification.js` is in a different part of the frontend, e.g., `src/hooks/`).
    *   When retrieving the `currentPlayerId` (currently an ETH address), convert it to UUID format using `ethAddressToUUID` before returning it.
    *   This ensures that any component or hook using `currentPlayerId` receives it in the correct UUID format.

    *Example (conceptual change in `usePlayerIdentification.js`):*
    ```javascript
    // import ethAddressToUUID from 'path/to/shared/utils'; // Or appropriate path

    // ... existing code to get ethAddress from user session/metadata ...
    // const ethAddress = user.user_metadata.eth_address; // Example, actual retrieval might differ
    
    // Convert to UUID
    // const currentPlayerIdAsUUID = ethAddressToUUID(ethAddress);

    // return { currentPlayerId: currentPlayerIdAsUUID, /* ... other properties ... */ };
    ```
    *(Note: The exact implementation details within `usePlayerIdentification.js` would depend on how it currently sources the ETH address. The key is to apply `ethAddressToUUID` to this address.)*

2.  **Verify `NFTSelection.tsx` (and other comparison points):**
    *   With `currentPlayerId` now being in UUID format, the direct comparisons in `NFTSelection.tsx` should work correctly:
        ```tsx
        // currentPlayerId is now expected to be UUID
        const isPlayer1 = gameData.player1_id === currentPlayerId; 
        const isPlayer2 = gameData.player2_id === currentPlayerId;
        ```
    *   The `isUserPartOfGame` helper function, while well-intentioned, might become less critical for basic player checks if `currentPlayerId` is consistently UUID. It could still be useful for more complex scenarios or as a fallback, but the primary reliance would shift to direct, type-consistent comparisons.

**Benefits of this approach:**

*   **Centralized Fix:** Addresses the problem at its most logical source (`usePlayerIdentification.js`).
*   **Consistency:** Ensures `currentPlayerId` has a uniform UUID format throughout the frontend, matching the database and backend expectations.
*   **Simplicity & Clarity:** Reduces the need to wrap every comparison with a special helper function, leading to cleaner and more straightforward conditional logic in components.
*   **RLS Alignment:** `auth.uid()` (used in RLS policies) is in UUID format. Having the frontend `currentPlayerId` also in UUID format simplifies reasoning about permissions and data access.

This approach directly implements the "Consider centralizing ID format conversion" part of the recommended strategy and is generally preferred for maintainability and reducing potential points of error.
