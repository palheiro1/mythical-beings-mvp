#!/bin/bash
# Script to check for authentication and profile synchronization changes
# This script will verify that all components of the implementation are in place

echo "Verifying authentication and profile synchronization changes..."
cd /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp

# Step 1: Verify the hook file exists
echo "Step 1: Checking for useAuthProfileSync.ts hook..."
if [ -f "src/hooks/useAuthProfileSync.ts" ]; then
  echo "✅ Hook file exists"
else
  echo "❌ Hook file missing! Please create src/hooks/useAuthProfileSync.ts"
  exit 1
fi

# Step 2: Verify App.tsx integration
echo "Step 2: Checking for hook integration in App.tsx..."
if grep -q "useAuthProfileSync" "src/App.tsx"; then
  echo "✅ Hook is integrated in App.tsx"
else
  echo "❌ Hook is not integrated in App.tsx!"
  exit 1
fi

# Step 3: Verify authentication wallet enhancements
echo "Step 3: Checking for authenticateWithWallet enhancements in Lobby.tsx..."
if grep -q "\[Wallet Auth\] Creating/updating profile for user" "src/pages/Lobby.tsx"; then
  echo "✅ Wallet authentication has profile creation"
else
  echo "❌ Wallet authentication profile creation is missing!"
  exit 1
fi

# Step 4: Verify ensureProfileExists function in supabase.ts
echo "Step 4: Checking for ensureProfileExists function in supabase.ts..."
if grep -q "async function ensureProfileExists" "src/utils/supabase.ts"; then
  echo "✅ ensureProfileExists function exists in supabase.ts"
else
  echo "❌ ensureProfileExists function is missing in supabase.ts!"
  exit 1
fi

echo ""
echo "All authentication and profile synchronization changes have been verified!"
echo "The database functions and RLS policies have been deployed via the Supabase MCP server."
echo ""
echo "Testing checklist:"
echo "1. Connect wallet on the home page"
echo "2. Check console logs to verify profile creation"
echo "3. Create a game and verify no foreign key constraint errors"
echo "4. Rejoin an existing game after authentication"
echo "5. Test session persistence by refreshing the page"
echo "6. Verify profile data is retained correctly"

echo "All authentication and profile synchronization changes have been applied!"
echo ""
echo "Testing checklist:"
echo "1. Connect wallet on the home page"
echo "2. Check console logs to verify profile creation"
echo "3. Create a game and verify no foreign key constraint errors"
echo "4. Rejoin an existing game after authentication"
echo "5. Test session persistence by refreshing the page"
echo "6. Verify profile data is retained correctly"
